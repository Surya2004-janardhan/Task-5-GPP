const { Worker, Queue } = require('bullmq');
const { Pool } = require('pg');
const Redis = require('ioredis');
const crypto = require('crypto');
const axios = require('axios');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

// Job queues
const webhookQueue = new Queue('webhook-delivery', { connection: redis });

// Environment configuration
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_PROCESSING_DELAY = parseInt(process.env.TEST_PROCESSING_DELAY) || 1000;
const TEST_PAYMENT_SUCCESS = process.env.TEST_PAYMENT_SUCCESS !== 'false';
const WEBHOOK_RETRY_INTERVALS_TEST = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';

// Retry intervals in milliseconds
const PRODUCTION_RETRY_INTERVALS = [0, 60000, 300000, 1800000, 7200000]; // 0, 1min, 5min, 30min, 2hr
const TEST_RETRY_INTERVALS = [0, 5000, 10000, 15000, 20000]; // 0, 5s, 10s, 15s, 20s

function getRetryIntervals() {
  return WEBHOOK_RETRY_INTERVALS_TEST ? TEST_RETRY_INTERVALS : PRODUCTION_RETRY_INTERVALS;
}

// Generate HMAC-SHA256 signature
function generateSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Payment Worker
const paymentWorker = new Worker('payment-processing', async (job) => {
  const { paymentId } = job.data;
  console.log(`Processing payment: ${paymentId}`);

  try {
    // Fetch payment
    const paymentResult = await pool.query(
      'SELECT p.*, m.webhook_url, m.webhook_secret FROM payments p JOIN merchants m ON p.merchant_id = m.id WHERE p.id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      console.error(`Payment not found: ${paymentId}`);
      return;
    }

    const payment = paymentResult.rows[0];

    // Simulate processing delay
    const delay = TEST_MODE ? TEST_PROCESSING_DELAY : Math.floor(Math.random() * 5000) + 5000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Determine success based on method and test mode
    let isSuccess;
    if (TEST_MODE) {
      isSuccess = TEST_PAYMENT_SUCCESS;
    } else {
      const successRate = payment.method === 'upi' ? 0.9 : 0.95;
      isSuccess = Math.random() < successRate;
    }

    const now = new Date().toISOString();

    if (isSuccess) {
      await pool.query(
        `UPDATE payments SET status = 'success', updated_at = $1 WHERE id = $2`,
        [now, paymentId]
      );
      console.log(`Payment ${paymentId} succeeded`);

      // Enqueue webhook for success
      if (payment.webhook_url) {
        await enqueueWebhook(payment.merchant_id, 'payment.success', {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            ...(payment.vpa && { vpa: payment.vpa }),
            status: 'success',
            created_at: payment.created_at
          }
        });
      }
    } else {
      await pool.query(
        `UPDATE payments SET status = 'failed', error_code = 'PAYMENT_FAILED', error_description = 'Payment processing failed', updated_at = $1 WHERE id = $2`,
        [now, paymentId]
      );
      console.log(`Payment ${paymentId} failed`);

      // Enqueue webhook for failure
      if (payment.webhook_url) {
        await enqueueWebhook(payment.merchant_id, 'payment.failed', {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            status: 'failed',
            error_code: 'PAYMENT_FAILED',
            error_description: 'Payment processing failed',
            created_at: payment.created_at
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error processing payment ${paymentId}:`, error);
    throw error;
  }
}, { connection: redis });

// Refund Worker
const refundWorker = new Worker('refund-processing', async (job) => {
  const { refundId } = job.data;
  console.log(`Processing refund: ${refundId}`);

  try {
    // Fetch refund and payment
    const refundResult = await pool.query(
      `SELECT r.*, p.amount as payment_amount, p.status as payment_status, m.webhook_url 
       FROM refunds r 
       JOIN payments p ON r.payment_id = p.id 
       JOIN merchants m ON r.merchant_id = m.id 
       WHERE r.id = $1`,
      [refundId]
    );

    if (refundResult.rows.length === 0) {
      console.error(`Refund not found: ${refundId}`);
      return;
    }

    const refund = refundResult.rows[0];

    // Verify payment is refundable
    if (refund.payment_status !== 'success') {
      console.error(`Payment ${refund.payment_id} is not in refundable state`);
      return;
    }

    // Simulate processing delay
    const delay = TEST_MODE ? TEST_PROCESSING_DELAY : Math.floor(Math.random() * 2000) + 3000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const now = new Date().toISOString();

    // Update refund status
    await pool.query(
      `UPDATE refunds SET status = 'processed', processed_at = $1 WHERE id = $2`,
      [now, refundId]
    );
    console.log(`Refund ${refundId} processed`);

    // Enqueue webhook for refund processed
    if (refund.webhook_url) {
      await enqueueWebhook(refund.merchant_id, 'refund.processed', {
        refund: {
          id: refund.id,
          payment_id: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          status: 'processed',
          created_at: refund.created_at,
          processed_at: now
        }
      });
    }
  } catch (error) {
    console.error(`Error processing refund ${refundId}:`, error);
    throw error;
  }
}, { connection: redis });

// Webhook Worker
const webhookWorker = new Worker('webhook-delivery', async (job) => {
  const { webhookLogId, merchantId, event, payload } = job.data;
  console.log(`Delivering webhook: ${event} for merchant ${merchantId}`);

  try {
    // Fetch merchant
    const merchantResult = await pool.query(
      'SELECT * FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      console.error(`Merchant not found: ${merchantId}`);
      return;
    }

    const merchant = merchantResult.rows[0];

    if (!merchant.webhook_url) {
      console.log(`No webhook URL configured for merchant ${merchantId}`);
      return;
    }

    // Get or create webhook log
    let webhookLog;
    if (webhookLogId) {
      const logResult = await pool.query(
        'SELECT * FROM webhook_logs WHERE id = $1',
        [webhookLogId]
      );
      webhookLog = logResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts)
         VALUES ($1, $2, $3, 'pending', 0) RETURNING *`,
        [merchantId, event, JSON.stringify(payload)]
      );
      webhookLog = insertResult.rows[0];
    }

    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(payloadString, merchant.webhook_secret);
    const now = new Date().toISOString();

    try {
      const response = await axios.post(merchant.webhook_url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 5000
      });

      // Success
      await pool.query(
        `UPDATE webhook_logs 
         SET status = 'success', attempts = attempts + 1, last_attempt_at = $1, response_code = $2, response_body = $3
         WHERE id = $4`,
        [now, response.status, JSON.stringify(response.data).substring(0, 1000), webhookLog.id]
      );
      console.log(`Webhook ${webhookLog.id} delivered successfully`);

    } catch (error) {
      const attempts = webhookLog.attempts + 1;
      const responseCode = error.response?.status || 0;
      const responseBody = error.message;

      if (attempts >= 5) {
        // Max attempts reached, mark as failed
        await pool.query(
          `UPDATE webhook_logs 
           SET status = 'failed', attempts = $1, last_attempt_at = $2, response_code = $3, response_body = $4
           WHERE id = $5`,
          [attempts, now, responseCode, responseBody, webhookLog.id]
        );
        console.log(`Webhook ${webhookLog.id} failed permanently after ${attempts} attempts`);
      } else {
        // Schedule retry
        const intervals = getRetryIntervals();
        const nextRetryDelay = intervals[attempts] || intervals[intervals.length - 1];
        const nextRetryAt = new Date(Date.now() + nextRetryDelay).toISOString();

        await pool.query(
          `UPDATE webhook_logs 
           SET status = 'pending', attempts = $1, last_attempt_at = $2, next_retry_at = $3, response_code = $4, response_body = $5
           WHERE id = $6`,
          [attempts, now, nextRetryAt, responseCode, responseBody, webhookLog.id]
        );

        // Schedule next attempt
        await webhookQueue.add('deliver-webhook', {
          webhookLogId: webhookLog.id,
          merchantId,
          event,
          payload
        }, { delay: nextRetryDelay });

        console.log(`Webhook ${webhookLog.id} failed, retry scheduled in ${nextRetryDelay}ms`);
      }
    }
  } catch (error) {
    console.error(`Error delivering webhook:`, error);
    throw error;
  }
}, { connection: redis });

// Helper function to enqueue webhook
async function enqueueWebhook(merchantId, event, data) {
  const payload = {
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data
  };

  await webhookQueue.add('deliver-webhook', {
    merchantId,
    event,
    payload
  });
}

// Error handlers
paymentWorker.on('failed', (job, err) => {
  console.error(`Payment job ${job.id} failed:`, err);
});

refundWorker.on('failed', (job, err) => {
  console.error(`Refund job ${job.id} failed:`, err);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`Webhook job ${job.id} failed:`, err);
});

console.log('Worker service started');
console.log(`Test Mode: ${TEST_MODE}`);
console.log(`Webhook Retry Test Mode: ${WEBHOOK_RETRY_INTERVALS_TEST}`);
