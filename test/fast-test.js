/**
 * Fast Test Runner with TEST_MODE enabled
 * For running tests with deterministic and faster results
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-Api-Key': 'key_test_abc123',
    'X-Api-Secret': 'secret_test_xyz789',
    'Content-Type': 'application/json'
  },
  validateStatus: () => true
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFastTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       PAYMENT GATEWAY - FAST END-TO-END TEST               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Note: For fastest tests, ensure TEST_MODE=true in docker-compose.yml\n');

  let passed = 0;
  let failed = 0;

  function check(condition, name) {
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  }

  // 1. Health Check
  console.log('\n📋 HEALTH CHECKS\n');
  const health = await api.get('/health');
  check(health.status === 200, 'API is healthy');

  const jobStatus = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
  check(jobStatus.data.worker_status === 'running', 'Worker is running');

  // 2. Complete Payment Flow
  console.log('\n📋 COMPLETE PAYMENT FLOW\n');
  
  // Create order
  const order = await api.post('/api/v1/orders', {
    amount: 100000,
    currency: 'INR',
    receipt: 'test_receipt_' + Date.now()
  });
  check(order.status === 201, 'Order created');
  const orderId = order.data.id;
  console.log(`   Order ID: ${orderId}`);

  // Create payment
  const payment = await api.post('/api/v1/payments', {
    order_id: orderId,
    method: 'upi',
    vpa: 'test@upi'
  });
  check(payment.status === 201, 'Payment created');
  check(payment.data.status === 'pending', 'Payment status is pending');
  const paymentId = payment.data.id;
  console.log(`   Payment ID: ${paymentId}`);

  // Wait for processing
  console.log('\n   ⏳ Waiting for payment processing...');
  let attempts = 0;
  let paymentStatus = 'pending';
  while (paymentStatus === 'pending' && attempts < 20) {
    await sleep(1000);
    const check = await api.get(`/api/v1/payments/${paymentId}`);
    paymentStatus = check.data.status;
    attempts++;
    process.stdout.write(`\r   ⏳ Waiting... ${attempts}s (status: ${paymentStatus})`);
  }
  console.log('');
  
  check(paymentStatus === 'success' || paymentStatus === 'failed', 
    `Payment processed (status: ${paymentStatus})`);

  if (paymentStatus === 'success') {
    // Capture payment
    const capture = await api.post(`/api/v1/payments/${paymentId}/capture`, { amount: 100000 });
    check(capture.status === 200, 'Payment captured');
    check(capture.data.captured === true, 'Captured flag is true');

    // Create refund
    const refund = await api.post(`/api/v1/payments/${paymentId}/refunds`, {
      amount: 50000,
      reason: 'Test partial refund'
    });
    check(refund.status === 201, 'Partial refund created');
    const refundId = refund.data.id;
    console.log(`   Refund ID: ${refundId}`);

    // Wait for refund processing
    console.log('\n   ⏳ Waiting for refund processing...');
    attempts = 0;
    let refundStatus = 'pending';
    while (refundStatus === 'pending' && attempts < 10) {
      await sleep(1000);
      const check = await api.get(`/api/v1/refunds/${refundId}`);
      refundStatus = check.data.status;
      attempts++;
      process.stdout.write(`\r   ⏳ Waiting... ${attempts}s (status: ${refundStatus})`);
    }
    console.log('');
    check(refundStatus === 'processed', 'Refund processed');

    // Try exceeding refund
    const badRefund = await api.post(`/api/v1/payments/${paymentId}/refunds`, {
      amount: 100000,
      reason: 'Should fail'
    });
    check(badRefund.status === 400, 'Exceeding refund rejected');
  } else {
    console.log('   ⚠️ Payment failed, skipping capture/refund tests');
  }

  // 3. Idempotency Test
  console.log('\n📋 IDEMPOTENCY TEST\n');
  
  const newOrder = await api.post('/api/v1/orders', { amount: 10000, currency: 'INR' });
  const idemKey = `idem_${Date.now()}`;
  
  const p1 = await api.post('/api/v1/payments', 
    { order_id: newOrder.data.id, method: 'upi', vpa: 'test@upi' },
    { headers: { 'Idempotency-Key': idemKey } }
  );
  
  const p2 = await api.post('/api/v1/payments',
    { order_id: newOrder.data.id, method: 'upi', vpa: 'test@upi' },
    { headers: { 'Idempotency-Key': idemKey } }
  );
  
  check(p1.data.id === p2.data.id, 'Idempotency key returns same payment');

  // 4. Webhook Logs
  console.log('\n📋 WEBHOOK SYSTEM\n');
  
  const webhooks = await api.get('/api/v1/webhooks?limit=5');
  check(webhooks.status === 200, 'Webhook logs accessible');
  console.log(`   Total webhook logs: ${webhooks.data.total}`);

  if (webhooks.data.data.length > 0) {
    const log = webhooks.data.data[0];
    console.log(`   Latest: ${log.event} - ${log.status} (${log.attempts} attempts)`);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                       SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`   Total: ${passed + failed}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runFastTests().catch(console.error);
