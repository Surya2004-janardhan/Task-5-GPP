const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { Queue } = require('bullmq');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL);

// Job queues
const paymentQueue = new Queue('payment-processing', { connection: redis });
const webhookQueue = new Queue('webhook-delivery', { connection: redis });
const refundQueue = new Queue('refund-processing', { connection: redis });

// Helper functions
function generatePaymentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'pay_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'order_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRefundId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'rfnd_';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateWebhookSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Authentication middleware
async function authenticateMerchant(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const apiSecret = req.headers['x-api-secret'];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        description: 'Missing API credentials'
      }
    });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2',
      [apiKey, apiSecret]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          description: 'Invalid API credentials'
        }
      });
    }

    req.merchant = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Authentication failed'
      }
    });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create Order
app.post('/api/v1/orders', authenticateMerchant, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Invalid amount'
        }
      });
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO orders (id, merchant_id, amount, currency, receipt, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'created', $6, $6)`,
      [orderId, req.merchant.id, amount, currency, receipt, now]
    );

    res.status(201).json({
      id: orderId,
      amount,
      currency,
      receipt,
      status: 'created',
      created_at: now
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create order'
      }
    });
  }
});

// Get Order
app.get('/api/v1/orders/:orderId', authenticateMerchant, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND merchant_id = $2',
      [req.params.orderId, req.merchant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Order not found'
        }
      });
    }

    const order = result.rows[0];
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to get order'
      }
    });
  }
});

// Create Payment
app.post('/api/v1/payments', authenticateMerchant, async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    
    // Check idempotency key
    if (idempotencyKey) {
      const cachedResult = await pool.query(
        `SELECT * FROM idempotency_keys 
         WHERE key = $1 AND merchant_id = $2 AND expires_at > NOW()`,
        [idempotencyKey, req.merchant.id]
      );

      if (cachedResult.rows.length > 0) {
        return res.status(201).json(cachedResult.rows[0].response);
      }

      // Delete expired key if exists
      await pool.query(
        'DELETE FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
        [idempotencyKey, req.merchant.id]
      );
    }

    const { order_id, method, vpa, card_number, card_expiry, card_cvv } = req.body;

    if (!order_id || !method) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Missing required fields'
        }
      });
    }

    // Validate order exists and belongs to merchant
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND merchant_id = $2',
      [order_id, req.merchant.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Order not found'
        }
      });
    }

    const order = orderResult.rows[0];

    // Validate payment method
    if (!['upi', 'card'].includes(method)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Invalid payment method'
        }
      });
    }

    if (method === 'upi' && !vpa) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'VPA is required for UPI payments'
        }
      });
    }

    if (method === 'card' && (!card_number || !card_expiry || !card_cvv)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Card details are required for card payments'
        }
      });
    }

    const paymentId = generatePaymentId();
    const now = new Date().toISOString();
    
    let cardLast4 = null;
    let cardNetwork = null;
    
    if (method === 'card') {
      cardLast4 = card_number.slice(-4);
      cardNetwork = card_number.startsWith('4') ? 'visa' : 
                   card_number.startsWith('5') ? 'mastercard' : 'unknown';
    }

    await pool.query(
      `INSERT INTO payments (id, order_id, merchant_id, amount, currency, method, vpa, card_last4, card_network, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $10)`,
      [paymentId, order_id, req.merchant.id, order.amount, order.currency, method, vpa, cardLast4, cardNetwork, now]
    );

    // Enqueue payment processing job
    await paymentQueue.add('process-payment', { paymentId }, { 
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });

    const response = {
      id: paymentId,
      order_id,
      amount: order.amount,
      currency: order.currency,
      method,
      ...(method === 'upi' && { vpa }),
      ...(method === 'card' && { card_last4: cardLast4, card_network: cardNetwork }),
      status: 'pending',
      created_at: now
    };

    // Store idempotency key
    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await pool.query(
        `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, req.merchant.id, JSON.stringify(response), expiresAt]
      );
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create payment'
      }
    });
  }
});

// Get Payment
app.get('/api/v1/payments/:paymentId', authenticateMerchant, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [req.params.paymentId, req.merchant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = result.rows[0];
    res.json({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      ...(payment.vpa && { vpa: payment.vpa }),
      ...(payment.card_last4 && { card_last4: payment.card_last4 }),
      ...(payment.card_network && { card_network: payment.card_network }),
      status: payment.status,
      captured: payment.captured,
      ...(payment.error_code && { error_code: payment.error_code }),
      ...(payment.error_description && { error_description: payment.error_description }),
      created_at: payment.created_at,
      updated_at: payment.updated_at
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to get payment'
      }
    });
  }
});

// Capture Payment
app.post('/api/v1/payments/:paymentId/capture', authenticateMerchant, async (req, res) => {
  try {
    const { amount } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [req.params.paymentId, req.merchant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = result.rows[0];

    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment not in capturable state'
        }
      });
    }

    if (payment.captured) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment already captured'
        }
      });
    }

    const now = new Date().toISOString();
    await pool.query(
      'UPDATE payments SET captured = TRUE, updated_at = $1 WHERE id = $2',
      [now, req.params.paymentId]
    );

    res.json({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      captured: true,
      created_at: payment.created_at,
      updated_at: now
    });
  } catch (error) {
    console.error('Capture payment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to capture payment'
      }
    });
  }
});

// Create Refund
app.post('/api/v1/payments/:paymentId/refunds', authenticateMerchant, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const paymentId = req.params.paymentId;

    // Get payment
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [paymentId, req.merchant.id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Only successful payments can be refunded'
        }
      });
    }

    // Calculate total refunded
    const refundedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded 
       FROM refunds WHERE payment_id = $1`,
      [paymentId]
    );

    const totalRefunded = parseInt(refundedResult.rows[0].total_refunded);
    const availableAmount = payment.amount - totalRefunded;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Invalid refund amount'
        }
      });
    }

    if (amount > availableAmount) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Refund amount exceeds available amount'
        }
      });
    }

    const refundId = generateRefundId();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [refundId, paymentId, req.merchant.id, amount, reason, now]
    );

    // Enqueue refund processing job
    await refundQueue.add('process-refund', { refundId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });

    res.status(201).json({
      id: refundId,
      payment_id: paymentId,
      amount,
      reason,
      status: 'pending',
      created_at: now
    });
  } catch (error) {
    console.error('Create refund error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create refund'
      }
    });
  }
});

// Get Refund
app.get('/api/v1/refunds/:refundId', authenticateMerchant, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2',
      [req.params.refundId, req.merchant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Refund not found'
        }
      });
    }

    const refund = result.rows[0];
    res.json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
      ...(refund.processed_at && { processed_at: refund.processed_at })
    });
  } catch (error) {
    console.error('Get refund error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to get refund'
      }
    });
  }
});

// List Webhook Logs
app.get('/api/v1/webhooks', authenticateMerchant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT * FROM webhook_logs 
       WHERE merchant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM webhook_logs WHERE merchant_id = $1',
      [req.merchant.id]
    );

    res.json({
      data: result.rows.map(log => ({
        id: log.id,
        event: log.event,
        status: log.status,
        attempts: log.attempts,
        created_at: log.created_at,
        last_attempt_at: log.last_attempt_at,
        response_code: log.response_code
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('List webhooks error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to list webhooks'
      }
    });
  }
});

// Retry Webhook
app.post('/api/v1/webhooks/:webhookId/retry', authenticateMerchant, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM webhook_logs WHERE id = $1 AND merchant_id = $2',
      [req.params.webhookId, req.merchant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Webhook log not found'
        }
      });
    }

    const webhook = result.rows[0];

    // Reset attempts and status
    await pool.query(
      `UPDATE webhook_logs SET attempts = 0, status = 'pending', next_retry_at = NOW()
       WHERE id = $1`,
      [req.params.webhookId]
    );

    // Enqueue webhook delivery
    await webhookQueue.add('deliver-webhook', {
      webhookLogId: webhook.id,
      merchantId: req.merchant.id,
      event: webhook.event,
      payload: webhook.payload
    });

    res.json({
      id: webhook.id,
      status: 'pending',
      message: 'Webhook retry scheduled'
    });
  } catch (error) {
    console.error('Retry webhook error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to retry webhook'
      }
    });
  }
});

// Job Queue Status (Test Endpoint)
app.get('/api/v1/test/jobs/status', async (req, res) => {
  try {
    const paymentWaiting = await paymentQueue.getWaitingCount();
    const paymentActive = await paymentQueue.getActiveCount();
    const paymentCompleted = await paymentQueue.getCompletedCount();
    const paymentFailed = await paymentQueue.getFailedCount();

    const webhookWaiting = await webhookQueue.getWaitingCount();
    const webhookActive = await webhookQueue.getActiveCount();

    const refundWaiting = await refundQueue.getWaitingCount();
    const refundActive = await refundQueue.getActiveCount();

    res.json({
      pending: paymentWaiting + webhookWaiting + refundWaiting,
      processing: paymentActive + webhookActive + refundActive,
      completed: paymentCompleted,
      failed: paymentFailed,
      worker_status: 'running'
    });
  } catch (error) {
    console.error('Job status error:', error);
    res.json({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      worker_status: 'unknown'
    });
  }
});

// Update Merchant Webhook URL
app.put('/api/v1/merchants/webhook', authenticateMerchant, async (req, res) => {
  try {
    const { webhook_url } = req.body;

    await pool.query(
      'UPDATE merchants SET webhook_url = $1, updated_at = NOW() WHERE id = $2',
      [webhook_url, req.merchant.id]
    );

    res.json({
      message: 'Webhook URL updated successfully',
      webhook_url
    });
  } catch (error) {
    console.error('Update webhook URL error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to update webhook URL'
      }
    });
  }
});

// Get Merchant Profile
app.get('/api/v1/merchants/profile', authenticateMerchant, async (req, res) => {
  try {
    res.json({
      id: req.merchant.id,
      name: req.merchant.name,
      email: req.merchant.email,
      api_key: req.merchant.api_key,
      webhook_url: req.merchant.webhook_url,
      webhook_secret: req.merchant.webhook_secret,
      created_at: req.merchant.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to get profile'
      }
    });
  }
});

// Regenerate Webhook Secret
app.post('/api/v1/merchants/webhook/regenerate-secret', authenticateMerchant, async (req, res) => {
  try {
    const newSecret = generateWebhookSecret();

    await pool.query(
      'UPDATE merchants SET webhook_secret = $1, updated_at = NOW() WHERE id = $2',
      [newSecret, req.merchant.id]
    );

    res.json({
      webhook_secret: newSecret
    });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to regenerate webhook secret'
      }
    });
  }
});

// Test Webhook
app.post('/api/v1/merchants/webhook/test', authenticateMerchant, async (req, res) => {
  try {
    if (!req.merchant.webhook_url) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Webhook URL not configured'
        }
      });
    }

    const testPayload = {
      event: 'test.webhook',
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        message: 'This is a test webhook'
      }
    };

    // Enqueue test webhook
    await webhookQueue.add('deliver-webhook', {
      merchantId: req.merchant.id,
      event: 'test.webhook',
      payload: testPayload
    });

    res.json({
      message: 'Test webhook scheduled'
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to send test webhook'
      }
    });
  }
});

// List Orders
app.get('/api/v1/orders', authenticateMerchant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT * FROM orders WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM orders WHERE merchant_id = $1',
      [req.merchant.id]
    );

    res.json({
      data: result.rows.map(order => ({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to list orders'
      }
    });
  }
});

// List Payments
app.get('/api/v1/payments', authenticateMerchant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT * FROM payments WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM payments WHERE merchant_id = $1',
      [req.merchant.id]
    );

    res.json({
      data: result.rows.map(payment => ({
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        captured: payment.captured,
        created_at: payment.created_at
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to list payments'
      }
    });
  }
});

// List Refunds
app.get('/api/v1/refunds', authenticateMerchant, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT * FROM refunds WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM refunds WHERE merchant_id = $1',
      [req.merchant.id]
    );

    res.json({
      data: result.rows.map(refund => ({
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        created_at: refund.created_at,
        processed_at: refund.processed_at
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('List refunds error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to list refunds'
      }
    });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Payment Gateway API running on port ${PORT}`);
});
