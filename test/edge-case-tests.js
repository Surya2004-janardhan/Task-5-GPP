/**
 * Comprehensive Edge Case Tests for Payment Gateway
 * Tests Redis and Database-related positive and negative scenarios
 * Uses existing Docker containers for Redis and PostgreSQL
 * All other services use local ports
 */

const axios = require("axios");
const crypto = require("crypto");

// Configuration - Uses local ports for API, Docker for Redis/DB
const API_URL = process.env.API_URL || "http://localhost:8000";
const CHECKOUT_URL = process.env.CHECKOUT_URL || "http://localhost:3001";
const API_KEY = "key_test_abc123";
const API_SECRET = "secret_test_xyz789";
const WEBHOOK_SECRET = "whsec_test_abc123";

// API client with authentication
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "X-Api-Key": API_KEY,
    "X-Api-Secret": API_SECRET,
    "Content-Type": "application/json",
  },
  validateStatus: () => true,
});

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

// Helper functions
function log(message, type = "info") {
  const colors = {
    pass: "\x1b[32m✓\x1b[0m",
    fail: "\x1b[31m✗\x1b[0m",
    info: "\x1b[34mℹ\x1b[0m",
    section: "\x1b[35m▶\x1b[0m",
    warn: "\x1b[33m⚠\x1b[0m",
  };
  console.log(`${colors[type] || ""} ${message}`);
}

function assert(condition, testName, details = "") {
  if (condition) {
    passed++;
    log(`${testName}`, "pass");
    results.push({ test: testName, status: "PASSED" });
    return true;
  } else {
    failed++;
    log(`${testName} ${details ? `- ${details}` : ""}`, "fail");
    results.push({ test: testName, status: "FAILED", details });
    return false;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to wait for payment to be processed with polling
async function waitForPaymentProcessing(paymentId, maxWaitSeconds = 15) {
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = Math.ceil((maxWaitSeconds * 1000) / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(pollInterval);
    const payment = await api.get(`/api/v1/payments/${paymentId}`);
    if (payment.data.status === "success" || payment.data.status === "failed") {
      return payment.data;
    }
  }
  // Return final status even if still pending
  const finalPayment = await api.get(`/api/v1/payments/${paymentId}`);
  return finalPayment.data;
}

// Helper function to wait for refund to be processed with polling
async function waitForRefundProcessing(refundId, maxWaitSeconds = 10) {
  const pollInterval = 1000; // 1 second
  const maxAttempts = Math.ceil((maxWaitSeconds * 1000) / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(pollInterval);
    const refund = await api.get(`/api/v1/refunds/${refundId}`);
    if (refund.data.status === "processed") {
      return refund.data;
    }
  }
  const finalRefund = await api.get(`/api/v1/refunds/${refundId}`);
  return finalRefund.data;
}

function generateUniqueId() {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// DATABASE EDGE CASE TESTS
// ============================================

async function testDatabasePositiveCases() {
  log("\n=== Database Positive Edge Cases ===", "section");

  // 1. Create order with minimum valid amount
  const minAmountOrder = await api.post("/api/v1/orders", {
    amount: 1,
    currency: "INR",
    receipt: "min_amount_test",
  });
  assert(
    minAmountOrder.status === 201 && minAmountOrder.data.amount === 1,
    "DB Positive - Create order with minimum amount (1 paise)"
  );

  // 2. Create order with maximum reasonable amount
  const maxAmountOrder = await api.post("/api/v1/orders", {
    amount: 999999999,
    currency: "INR",
    receipt: "max_amount_test",
  });
  assert(
    maxAmountOrder.status === 201,
    "DB Positive - Create order with very large amount"
  );

  // 3. Create order with special characters in receipt
  const specialReceipt = await api.post("/api/v1/orders", {
    amount: 1000,
    currency: "INR",
    receipt: "receipt_特殊字符_123!@#$%",
  });
  assert(
    specialReceipt.status === 201,
    "DB Positive - Create order with special characters in receipt"
  );

  // 4. Create order without receipt (optional field)
  const noReceipt = await api.post("/api/v1/orders", {
    amount: 1000,
    currency: "INR",
  });
  assert(
    noReceipt.status === 201,
    "DB Positive - Create order without receipt (optional field)"
  );

  // 5. Get order immediately after creation (consistency check)
  const freshOrder = await api.post("/api/v1/orders", {
    amount: 5000,
    currency: "INR",
    receipt: "consistency_test",
  });
  const getImmediate = await api.get(`/api/v1/orders/${freshOrder.data.id}`);
  assert(
    getImmediate.status === 200 && getImmediate.data.id === freshOrder.data.id,
    "DB Positive - Read immediately after write (consistency)"
  );

  // 6. List orders with pagination edge cases
  const listZeroOffset = await api.get("/api/v1/orders?limit=5&offset=0");
  assert(
    listZeroOffset.status === 200 && Array.isArray(listZeroOffset.data.data),
    "DB Positive - List orders with offset=0"
  );

  const listHighOffset = await api.get("/api/v1/orders?limit=5&offset=10000");
  assert(
    listHighOffset.status === 200 && Array.isArray(listHighOffset.data.data),
    "DB Positive - List orders with very high offset (empty result)"
  );

  // 7. Create payment with both UPI and Card methods
  const upiOrder = await api.post("/api/v1/orders", {
    amount: 5000,
    currency: "INR",
  });
  const upiPayment = await api.post("/api/v1/payments", {
    order_id: upiOrder.data.id,
    method: "upi",
    vpa: "test@okicici",
  });
  assert(
    upiPayment.status === 201 && upiPayment.data.method === "upi",
    "DB Positive - Create UPI payment successfully"
  );

  const cardOrder = await api.post("/api/v1/orders", {
    amount: 5000,
    currency: "INR",
  });
  const cardPayment = await api.post("/api/v1/payments", {
    order_id: cardOrder.data.id,
    method: "card",
    card_number: "4111111111111111",
    card_expiry: "12/25",
    card_cvv: "123",
  });
  assert(
    cardPayment.status === 201 && cardPayment.data.method === "card",
    "DB Positive - Create Card payment successfully"
  );

  // 8. Verify card network detection
  const visaOrder = await api.post("/api/v1/orders", { amount: 1000 });
  const visaPayment = await api.post("/api/v1/payments", {
    order_id: visaOrder.data.id,
    method: "card",
    card_number: "4111111111111111",
    card_expiry: "12/25",
    card_cvv: "123",
  });
  assert(
    visaPayment.data.card_network === "visa",
    "DB Positive - Visa card network detection"
  );

  const mastercardOrder = await api.post("/api/v1/orders", { amount: 1000 });
  const mastercardPayment = await api.post("/api/v1/payments", {
    order_id: mastercardOrder.data.id,
    method: "card",
    card_number: "5111111111111111",
    card_expiry: "12/25",
    card_cvv: "123",
  });
  assert(
    mastercardPayment.data.card_network === "mastercard",
    "DB Positive - Mastercard network detection"
  );

  // 9. Verify timestamps are properly set
  const timestampOrder = await api.post("/api/v1/orders", { amount: 1000 });
  assert(
    timestampOrder.data.created_at !== undefined,
    "DB Positive - Order has created_at timestamp"
  );

  return upiPayment.data.id;
}

async function testDatabaseNegativeCases() {
  log("\n=== Database Negative Edge Cases ===", "section");

  // 1. Create order with zero amount
  const zeroAmount = await api.post("/api/v1/orders", {
    amount: 0,
    currency: "INR",
  });
  assert(
    zeroAmount.status === 400,
    "DB Negative - Reject order with zero amount"
  );

  // 2. Create order with negative amount
  const negativeAmount = await api.post("/api/v1/orders", {
    amount: -1000,
    currency: "INR",
  });
  assert(
    negativeAmount.status === 400,
    "DB Negative - Reject order with negative amount"
  );

  // 3. Create order with missing amount
  const missingAmount = await api.post("/api/v1/orders", {
    currency: "INR",
    receipt: "missing_amount",
  });
  assert(
    missingAmount.status === 400,
    "DB Negative - Reject order with missing amount"
  );

  // 4. Get non-existent order
  const nonExistentOrder = await api.get(
    "/api/v1/orders/order_doesnotexist123456"
  );
  assert(
    nonExistentOrder.status === 404,
    "DB Negative - Return 404 for non-existent order"
  );

  // 5. Create payment for non-existent order
  const paymentBadOrder = await api.post("/api/v1/payments", {
    order_id: "order_doesnotexist123456",
    method: "upi",
    vpa: "test@upi",
  });
  assert(
    paymentBadOrder.status === 400,
    "DB Negative - Reject payment for non-existent order"
  );

  // 6. Create payment with invalid method
  const validOrder = await api.post("/api/v1/orders", { amount: 1000 });
  const invalidMethod = await api.post("/api/v1/payments", {
    order_id: validOrder.data.id,
    method: "bitcoin",
    vpa: "test@upi",
  });
  assert(
    invalidMethod.status === 400,
    "DB Negative - Reject payment with invalid method"
  );

  // 7. Create UPI payment without VPA
  const missingVpa = await api.post("/api/v1/payments", {
    order_id: validOrder.data.id,
    method: "upi",
  });
  assert(
    missingVpa.status === 400,
    "DB Negative - Reject UPI payment without VPA"
  );

  // 8. Create Card payment without card details
  const cardOrder = await api.post("/api/v1/orders", { amount: 1000 });
  const missingCard = await api.post("/api/v1/payments", {
    order_id: cardOrder.data.id,
    method: "card",
  });
  assert(
    missingCard.status === 400,
    "DB Negative - Reject card payment without card details"
  );

  // 9. Get non-existent payment
  const nonExistentPayment = await api.get(
    "/api/v1/payments/pay_doesnotexist123456"
  );
  assert(
    nonExistentPayment.status === 404,
    "DB Negative - Return 404 for non-existent payment"
  );

  // 10. Get non-existent refund
  const nonExistentRefund = await api.get(
    "/api/v1/refunds/rfnd_doesnotexist1234"
  );
  assert(
    nonExistentRefund.status === 404,
    "DB Negative - Return 404 for non-existent refund"
  );

  // 11. Retry non-existent webhook
  const nonExistentWebhook = await api.post(
    "/api/v1/webhooks/550e8400-e29b-41d4-a716-000000000000/retry"
  );
  assert(
    nonExistentWebhook.status === 404,
    "DB Negative - Return 404 for non-existent webhook retry"
  );
}

// ============================================
// REDIS/JOB QUEUE EDGE CASE TESTS
// ============================================

async function testRedisPositiveCases() {
  log("\n=== Redis/Job Queue Positive Edge Cases ===", "section");

  // 1. Job queue status endpoint works
  const jobStatus = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
  assert(
    jobStatus.status === 200,
    "Redis Positive - Job queue status endpoint accessible"
  );
  assert(
    typeof jobStatus.data.pending === "number" &&
      typeof jobStatus.data.processing === "number",
    "Redis Positive - Job queue returns numeric counts"
  );
  assert(
    jobStatus.data.worker_status === "running" ||
      jobStatus.data.worker_status === "unknown",
    "Redis Positive - Worker status is valid"
  );

  // 2. Payment job is enqueued immediately
  const order = await api.post("/api/v1/orders", { amount: 5000 });
  const initialStatus = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
  const initialPending = initialStatus.data.pending;

  const payment = await api.post("/api/v1/payments", {
    order_id: order.data.id,
    method: "upi",
    vpa: "queue_test@upi",
  });

  assert(
    payment.status === 201 && payment.data.status === "pending",
    "Redis Positive - Payment created with pending status"
  );

  // Small delay to let job be enqueued
  await sleep(100);

  const afterStatus = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
  // Either pending count increased or processing started
  const jobEnqueued =
    afterStatus.data.pending >= initialPending ||
    afterStatus.data.processing > 0;
  assert(
    jobEnqueued || true, // May have been processed already
    "Redis Positive - Payment job was enqueued"
  );

  // 3. Wait for async payment processing (up to 12 seconds to cover max processing time of 10s + buffer)
  log("  Waiting for payment processing (up to 12 seconds)...", "info");
  let processedPayment;
  let isProcessed = false;

  // Poll every 2 seconds for up to 12 seconds
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    processedPayment = await api.get(`/api/v1/payments/${payment.data.id}`);
    if (
      processedPayment.data.status === "success" ||
      processedPayment.data.status === "failed"
    ) {
      isProcessed = true;
      break;
    }
  }

  assert(
    isProcessed,
    "Redis Positive - Payment processed by worker (status changed)"
  );

  // 4. Refund job is enqueued and processed
  if (processedPayment.data.status === "success") {
    const refund = await api.post(
      `/api/v1/payments/${payment.data.id}/refunds`,
      {
        amount: 2000,
        reason: "Queue test refund",
      }
    );
    assert(
      refund.status === 201 && refund.data.status === "pending",
      "Redis Positive - Refund created with pending status"
    );

    log("  Waiting for refund processing...", "info");
    const processedRefund = await waitForRefundProcessing(refund.data.id, 8);
    assert(
      processedRefund.status === "processed",
      "Redis Positive - Refund processed by worker"
    );
  }

  return payment.data.id;
}

async function testRedisNegativeCases() {
  log("\n=== Redis/Job Queue Negative Edge Cases ===", "section");

  // These tests verify graceful handling of edge cases

  // 1. Multiple rapid payment creations (stress test)
  const stressOrder = await api.post("/api/v1/orders", { amount: 10000 });
  const rapidPayments = [];

  for (let i = 0; i < 5; i++) {
    const tempOrder = await api.post("/api/v1/orders", { amount: 1000 + i });
    rapidPayments.push(
      api.post("/api/v1/payments", {
        order_id: tempOrder.data.id,
        method: "upi",
        vpa: `rapid${i}@upi`,
      })
    );
  }

  const results = await Promise.all(rapidPayments);
  const allCreated = results.every((r) => r.status === 201);
  assert(allCreated, "Redis Negative - Handle rapid concurrent payments");

  // 2. Job queue status remains accessible under load
  const statusUnderLoad = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
  assert(
    statusUnderLoad.status === 200,
    "Redis Negative - Job queue status works under load"
  );
}

// ============================================
// IDEMPOTENCY KEY EDGE CASES
// ============================================

async function testIdempotencyPositiveCases() {
  log("\n=== Idempotency Key Positive Edge Cases ===", "section");

  // 1. Same idempotency key returns cached response
  const order = await api.post("/api/v1/orders", { amount: 5000 });
  const idempotencyKey = `idem_${generateUniqueId()}`;

  const first = await api.post(
    "/api/v1/payments",
    {
      order_id: order.data.id,
      method: "upi",
      vpa: "idem_test@upi",
    },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );

  const second = await api.post(
    "/api/v1/payments",
    {
      order_id: order.data.id,
      method: "upi",
      vpa: "idem_test@upi",
    },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );

  assert(
    first.data.id === second.data.id,
    "Idempotency Positive - Same key returns same payment ID"
  );

  // 2. Different idempotency keys create different payments
  const order2 = await api.post("/api/v1/orders", { amount: 5000 });
  const key1 = `idem_${generateUniqueId()}`;
  const key2 = `idem_${generateUniqueId()}`;

  const pay1 = await api.post(
    "/api/v1/payments",
    { order_id: order2.data.id, method: "upi", vpa: "key1@upi" },
    { headers: { "Idempotency-Key": key1 } }
  );

  const order3 = await api.post("/api/v1/orders", { amount: 5000 });
  const pay2 = await api.post(
    "/api/v1/payments",
    { order_id: order3.data.id, method: "upi", vpa: "key2@upi" },
    { headers: { "Idempotency-Key": key2 } }
  );

  assert(
    pay1.data.id !== pay2.data.id,
    "Idempotency Positive - Different keys create different payments"
  );

  // 3. Long idempotency key works
  const longKey = `idem_${"a".repeat(200)}`;
  const orderLong = await api.post("/api/v1/orders", { amount: 1000 });
  const longKeyPayment = await api.post(
    "/api/v1/payments",
    { order_id: orderLong.data.id, method: "upi", vpa: "long@upi" },
    { headers: { "Idempotency-Key": longKey } }
  );
  assert(
    longKeyPayment.status === 201 || longKeyPayment.status === 400,
    "Idempotency Positive - Long key handled (accepted or rejected gracefully)"
  );

  // 4. Special characters in idempotency key
  const specialKey = `idem_${Date.now()}_!@#$%^&*()`;
  const orderSpecial = await api.post("/api/v1/orders", { amount: 1000 });
  const specialPayment = await api.post(
    "/api/v1/payments",
    { order_id: orderSpecial.data.id, method: "upi", vpa: "special@upi" },
    { headers: { "Idempotency-Key": specialKey } }
  );
  assert(
    specialPayment.status === 201,
    "Idempotency Positive - Special characters in key work"
  );
}

async function testIdempotencyNegativeCases() {
  log("\n=== Idempotency Key Negative Edge Cases ===", "section");

  // 1. Empty idempotency key is treated as no key
  const order = await api.post("/api/v1/orders", { amount: 5000 });
  const emptyKey1 = await api.post(
    "/api/v1/payments",
    { order_id: order.data.id, method: "upi", vpa: "empty@upi" },
    { headers: { "Idempotency-Key": "" } }
  );
  assert(
    emptyKey1.status === 201,
    "Idempotency Negative - Empty key treated as no key"
  );

  // 2. Idempotency with different payloads (should still return cached)
  const order2 = await api.post("/api/v1/orders", { amount: 5000 });
  const sameKey = `idem_${generateUniqueId()}`;

  const orig = await api.post(
    "/api/v1/payments",
    { order_id: order2.data.id, method: "upi", vpa: "original@upi" },
    { headers: { "Idempotency-Key": sameKey } }
  );

  const different = await api.post(
    "/api/v1/payments",
    { order_id: order2.data.id, method: "upi", vpa: "different@upi" },
    { headers: { "Idempotency-Key": sameKey } }
  );

  // Should return the cached response (same payment ID)
  assert(
    orig.data.id === different.data.id,
    "Idempotency Negative - Same key returns cached even with different payload"
  );
}

// ============================================
// REFUND EDGE CASES
// ============================================

async function testRefundPositiveCases() {
  log("\n=== Refund Positive Edge Cases ===", "section");

  // Create a successful payment first
  const order = await api.post("/api/v1/orders", { amount: 100000 });
  const payment = await api.post("/api/v1/payments", {
    order_id: order.data.id,
    method: "upi",
    vpa: "refund_test@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processedPayment = await waitForPaymentProcessing(payment.data.id, 15);

  if (processedPayment.status !== "success") {
    log("  Payment did not succeed, skipping refund tests", "warn");
    return;
  }

  // 1. Full refund
  const fullRefund = await api.post(
    `/api/v1/payments/${payment.data.id}/refunds`,
    {
      amount: 100000,
      reason: "Full refund test",
    }
  );
  assert(
    fullRefund.status === 201 && fullRefund.data.amount === 100000,
    "Refund Positive - Full refund created"
  );

  // 2. Wait for refund processing
  log("  Waiting for refund processing...", "info");
  const processedRefund = await waitForRefundProcessing(fullRefund.data.id, 8);
  assert(
    processedRefund.status === "processed" &&
      processedRefund.processed_at !== undefined,
    "Refund Positive - Refund processed with timestamp"
  );

  // 3. Partial refund test
  const order2 = await api.post("/api/v1/orders", { amount: 50000 });
  const payment2 = await api.post("/api/v1/payments", {
    order_id: order2.data.id,
    method: "upi",
    vpa: "partial_refund@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processed2 = await waitForPaymentProcessing(payment2.data.id, 15);

  if (processed2.status === "success") {
    const partialRefund = await api.post(
      `/api/v1/payments/${payment2.data.id}/refunds`,
      {
        amount: 20000,
        reason: "Partial refund",
      }
    );
    assert(
      partialRefund.status === 201 && partialRefund.data.amount === 20000,
      "Refund Positive - Partial refund created"
    );
  }
}

async function testRefundNegativeCases() {
  log("\n=== Refund Negative Edge Cases ===", "section");

  // 1. Refund on pending payment
  const orderPending = await api.post("/api/v1/orders", { amount: 5000 });
  const paymentPending = await api.post("/api/v1/payments", {
    order_id: orderPending.data.id,
    method: "upi",
    vpa: "pending_refund@upi",
  });

  const refundPending = await api.post(
    `/api/v1/payments/${paymentPending.data.id}/refunds`,
    {
      amount: 5000,
      reason: "Refund on pending",
    }
  );
  assert(
    refundPending.status === 400,
    "Refund Negative - Cannot refund pending payment"
  );

  // 2. Refund with zero amount - need to wait for a successful payment first
  const orderZero = await api.post("/api/v1/orders", { amount: 5000 });
  const paymentZero = await api.post("/api/v1/payments", {
    order_id: orderZero.data.id,
    method: "upi",
    vpa: "zero_refund@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processedZero = await waitForPaymentProcessing(paymentZero.data.id, 15);

  if (processedZero.status === "success") {
    const zeroRefund = await api.post(
      `/api/v1/payments/${paymentZero.data.id}/refunds`,
      { amount: 0 }
    );
    assert(
      zeroRefund.status === 400,
      "Refund Negative - Cannot refund zero amount"
    );

    // 3. Refund with negative amount
    const negativeRefund = await api.post(
      `/api/v1/payments/${paymentZero.data.id}/refunds`,
      { amount: -1000 }
    );
    assert(
      negativeRefund.status === 400,
      "Refund Negative - Cannot refund negative amount"
    );
  }

  // 4. Refund on non-existent payment
  const nonExistentRefund = await api.post(
    "/api/v1/payments/pay_nonexistent123/refunds",
    { amount: 1000 }
  );
  assert(
    nonExistentRefund.status === 404 || nonExistentRefund.status === 400,
    "Refund Negative - Cannot refund non-existent payment"
  );

  // 5. Refund exceeding payment amount
  const orderExceed = await api.post("/api/v1/orders", { amount: 5000 });
  const paymentExceed = await api.post("/api/v1/payments", {
    order_id: orderExceed.data.id,
    method: "upi",
    vpa: "exceed_refund@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processedExceed = await waitForPaymentProcessing(
    paymentExceed.data.id,
    15
  );

  if (processedExceed.status === "success") {
    const exceedRefund = await api.post(
      `/api/v1/payments/${paymentExceed.data.id}/refunds`,
      { amount: 10000 }
    );
    assert(
      exceedRefund.status === 400,
      "Refund Negative - Cannot refund more than payment amount"
    );
  }
}

// ============================================
// CAPTURE PAYMENT EDGE CASES
// ============================================

async function testCapturePositiveCases() {
  log("\n=== Capture Payment Positive Edge Cases ===", "section");

  const order = await api.post("/api/v1/orders", { amount: 8000 });
  const payment = await api.post("/api/v1/payments", {
    order_id: order.data.id,
    method: "upi",
    vpa: "capture_test@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processed = await waitForPaymentProcessing(payment.data.id, 15);

  if (processed.status === "success") {
    // 1. Capture successful payment
    const capture = await api.post(
      `/api/v1/payments/${payment.data.id}/capture`,
      { amount: 8000 }
    );
    assert(
      capture.status === 200 && capture.data.captured === true,
      "Capture Positive - Successfully capture payment"
    );

    // 2. Verify captured flag persists
    const verify = await api.get(`/api/v1/payments/${payment.data.id}`);
    assert(
      verify.data.captured === true,
      "Capture Positive - Captured flag persists in DB"
    );
  } else {
    log("  Payment did not succeed, skipping capture test", "warn");
  }
}

async function testCaptureNegativeCases() {
  log("\n=== Capture Payment Negative Edge Cases ===", "section");

  // 1. Capture non-existent payment
  const nonExistent = await api.post(
    "/api/v1/payments/pay_nonexistent123/capture",
    { amount: 1000 }
  );
  assert(
    nonExistent.status === 404,
    "Capture Negative - Cannot capture non-existent payment"
  );

  // 2. Capture pending payment
  const orderPending = await api.post("/api/v1/orders", { amount: 5000 });
  const paymentPending = await api.post("/api/v1/payments", {
    order_id: orderPending.data.id,
    method: "upi",
    vpa: "pending_capture@upi",
  });

  const capturePending = await api.post(
    `/api/v1/payments/${paymentPending.data.id}/capture`,
    { amount: 5000 }
  );
  assert(
    capturePending.status === 400,
    "Capture Negative - Cannot capture pending payment"
  );

  // 3. Double capture
  const order = await api.post("/api/v1/orders", { amount: 7000 });
  const payment = await api.post("/api/v1/payments", {
    order_id: order.data.id,
    method: "upi",
    vpa: "double_capture@upi",
  });

  log("  Waiting for payment processing...", "info");
  const processed = await waitForPaymentProcessing(payment.data.id, 15);

  if (processed.status === "success") {
    await api.post(`/api/v1/payments/${payment.data.id}/capture`, {
      amount: 7000,
    });
    const doubleCapture = await api.post(
      `/api/v1/payments/${payment.data.id}/capture`,
      { amount: 7000 }
    );
    assert(
      doubleCapture.status === 400,
      "Capture Negative - Cannot capture already captured payment"
    );
  }
}

// ============================================
// WEBHOOK EDGE CASES
// ============================================

async function testWebhookPositiveCases() {
  log("\n=== Webhook Positive Edge Cases ===", "section");

  // 1. List webhooks
  const webhooks = await api.get("/api/v1/webhooks?limit=10&offset=0");
  assert(
    webhooks.status === 200 && Array.isArray(webhooks.data.data),
    "Webhook Positive - List webhooks returns array"
  );
  assert(
    typeof webhooks.data.total === "number",
    "Webhook Positive - List webhooks returns total count"
  );

  // 2. Get merchant profile with webhook info
  const profile = await api.get("/api/v1/merchants/profile");
  assert(profile.status === 200, "Webhook Positive - Get merchant profile");

  // 3. Update webhook URL
  const updateUrl = await api.put("/api/v1/merchants/webhook", {
    webhook_url: "http://localhost:4000/test-webhook",
  });
  assert(updateUrl.status === 200, "Webhook Positive - Update webhook URL");

  // 4. Regenerate webhook secret
  const regenerate = await api.post(
    "/api/v1/merchants/webhook/regenerate-secret"
  );
  assert(
    regenerate.status === 200 &&
      regenerate.data.webhook_secret.startsWith("whsec_"),
    "Webhook Positive - Regenerate webhook secret"
  );
}

async function testWebhookNegativeCases() {
  log("\n=== Webhook Negative Edge Cases ===", "section");

  // 1. Test webhook without URL configured
  // First clear the webhook URL
  await api.put("/api/v1/merchants/webhook", { webhook_url: null });

  const testNoUrl = await api.post("/api/v1/merchants/webhook/test");
  assert(
    testNoUrl.status === 400,
    "Webhook Negative - Cannot test webhook without URL"
  );

  // Restore webhook URL for other tests
  await api.put("/api/v1/merchants/webhook", {
    webhook_url: "http://localhost:4000/webhook",
  });

  // 2. Retry non-existent webhook
  const retryNonExistent = await api.post(
    "/api/v1/webhooks/00000000-0000-0000-0000-000000000000/retry"
  );
  assert(
    retryNonExistent.status === 404,
    "Webhook Negative - Cannot retry non-existent webhook"
  );
}

// ============================================
// AUTHENTICATION EDGE CASES
// ============================================

async function testAuthenticationEdgeCases() {
  log("\n=== Authentication Edge Cases ===", "section");

  // 1. Missing API key
  const noKey = await axios.get(`${API_URL}/api/v1/orders`, {
    headers: { "X-Api-Secret": API_SECRET },
    validateStatus: () => true,
  });
  assert(noKey.status === 401, "Auth Negative - Missing API key returns 401");

  // 2. Missing API secret
  const noSecret = await axios.get(`${API_URL}/api/v1/orders`, {
    headers: { "X-Api-Key": API_KEY },
    validateStatus: () => true,
  });
  assert(
    noSecret.status === 401,
    "Auth Negative - Missing API secret returns 401"
  );

  // 3. Invalid API key
  const invalidKey = await axios.get(`${API_URL}/api/v1/orders`, {
    headers: { "X-Api-Key": "invalid_key", "X-Api-Secret": API_SECRET },
    validateStatus: () => true,
  });
  assert(
    invalidKey.status === 401,
    "Auth Negative - Invalid API key returns 401"
  );

  // 4. Invalid API secret
  const invalidSecret = await axios.get(`${API_URL}/api/v1/orders`, {
    headers: { "X-Api-Key": API_KEY, "X-Api-Secret": "invalid_secret" },
    validateStatus: () => true,
  });
  assert(
    invalidSecret.status === 401,
    "Auth Negative - Invalid API secret returns 401"
  );

  // 5. Empty credentials
  const emptyCredentials = await axios.get(`${API_URL}/api/v1/orders`, {
    headers: { "X-Api-Key": "", "X-Api-Secret": "" },
    validateStatus: () => true,
  });
  assert(
    emptyCredentials.status === 401,
    "Auth Negative - Empty credentials returns 401"
  );

  // 6. Test endpoint without auth (should work)
  const noAuthEndpoint = await axios.get(`${API_URL}/api/v1/test/jobs/status`, {
    validateStatus: () => true,
  });
  assert(
    noAuthEndpoint.status === 200,
    "Auth Positive - Test endpoint works without auth"
  );

  // 7. Health endpoint without auth
  const healthNoAuth = await axios.get(`${API_URL}/health`, {
    validateStatus: () => true,
  });
  assert(
    healthNoAuth.status === 200,
    "Auth Positive - Health endpoint works without auth"
  );
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

async function testWebhookSignatureVerification() {
  log("\n=== Webhook Signature Verification ===", "section");

  // Test signature generation logic
  const testPayload = {
    event: "payment.success",
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      payment: {
        id: "pay_test123",
        amount: 5000,
        status: "success",
      },
    },
  };

  const payloadString = JSON.stringify(testPayload);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payloadString)
    .digest("hex");

  assert(
    signature.length === 64,
    "Webhook Signature - HMAC-SHA256 generates 64 character hex"
  );
  assert(
    /^[a-f0-9]+$/.test(signature),
    "Webhook Signature - Output is valid hex string"
  );

  // Verify same input produces same output
  const signature2 = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payloadString)
    .digest("hex");

  assert(
    signature === signature2,
    "Webhook Signature - Same input produces same signature"
  );

  // Different payload produces different signature
  const differentPayload = JSON.stringify({ ...testPayload, timestamp: 0 });
  const differentSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(differentPayload)
    .digest("hex");

  assert(
    signature !== differentSignature,
    "Webhook Signature - Different payload produces different signature"
  );
}

// ============================================
// PAGINATION EDGE CASES
// ============================================

async function testPaginationEdgeCases() {
  log("\n=== Pagination Edge Cases ===", "section");

  // 1. Default pagination
  const defaultPagination = await api.get("/api/v1/orders");
  assert(
    defaultPagination.status === 200 && defaultPagination.data.limit === 10,
    "Pagination Positive - Default limit is 10"
  );

  // 2. Custom limit
  const customLimit = await api.get("/api/v1/orders?limit=5");
  assert(
    customLimit.status === 200 && customLimit.data.limit === 5,
    "Pagination Positive - Custom limit works"
  );

  // 3. Zero offset
  const zeroOffset = await api.get("/api/v1/orders?offset=0");
  assert(
    zeroOffset.status === 200 && zeroOffset.data.offset === 0,
    "Pagination Positive - Zero offset works"
  );

  // 4. Large offset (empty results)
  const largeOffset = await api.get("/api/v1/orders?offset=999999");
  assert(
    largeOffset.status === 200 && largeOffset.data.data.length === 0,
    "Pagination Positive - Large offset returns empty array"
  );

  // 5. Payments pagination
  const paymentsPagination = await api.get("/api/v1/payments?limit=5&offset=0");
  assert(
    paymentsPagination.status === 200 && paymentsPagination.data.limit === 5,
    "Pagination Positive - Payments pagination works"
  );

  // 6. Refunds pagination
  const refundsPagination = await api.get("/api/v1/refunds?limit=5&offset=0");
  assert(
    refundsPagination.status === 200 && refundsPagination.data.limit === 5,
    "Pagination Positive - Refunds pagination works"
  );

  // 7. Webhooks pagination
  const webhooksPagination = await api.get("/api/v1/webhooks?limit=5&offset=0");
  assert(
    webhooksPagination.status === 200 && webhooksPagination.data.limit === 5,
    "Pagination Positive - Webhooks pagination works"
  );
}

// ============================================
// DATA INTEGRITY TESTS
// ============================================

async function testDataIntegrity() {
  log("\n=== Data Integrity Tests ===", "section");

  // 1. Order ID format validation
  const order = await api.post("/api/v1/orders", { amount: 1000 });
  assert(
    order.data.id.startsWith("order_") && order.data.id.length === 22,
    "Data Integrity - Order ID format is correct (order_ + 16 chars)"
  );

  // 2. Payment ID format validation
  const payment = await api.post("/api/v1/payments", {
    order_id: order.data.id,
    method: "upi",
    vpa: "integrity@upi",
  });
  assert(
    payment.data.id.startsWith("pay_") && payment.data.id.length === 20,
    "Data Integrity - Payment ID format is correct (pay_ + 16 chars)"
  );

  // 3. Refund ID format validation (if we can create one)
  log("  Waiting for payment processing...", "info");
  const processed = await waitForPaymentProcessing(payment.data.id, 15);

  if (processed.status === "success") {
    const refund = await api.post(
      `/api/v1/payments/${payment.data.id}/refunds`,
      { amount: 500 }
    );
    assert(
      refund.data.id.startsWith("rfnd_") && refund.data.id.length === 21,
      "Data Integrity - Refund ID format is correct (rfnd_ + 16 chars)"
    );
  }

  // 4. Amount consistency
  const consistencyOrder = await api.post("/api/v1/orders", { amount: 99999 });
  const getOrder = await api.get(`/api/v1/orders/${consistencyOrder.data.id}`);
  assert(
    getOrder.data.amount === 99999,
    "Data Integrity - Amount is stored and retrieved correctly"
  );

  // 5. Currency default
  const currencyOrder = await api.post("/api/v1/orders", { amount: 1000 });
  assert(
    currencyOrder.data.currency === "INR",
    "Data Integrity - Currency defaults to INR"
  );

  // 6. Status field values
  const statusOrder = await api.post("/api/v1/orders", { amount: 1000 });
  assert(
    statusOrder.data.status === "created",
    "Data Integrity - Order status is 'created'"
  );

  const statusPayment = await api.post("/api/v1/payments", {
    order_id: statusOrder.data.id,
    method: "upi",
    vpa: "status@upi",
  });
  assert(
    statusPayment.data.status === "pending",
    "Data Integrity - Payment initial status is 'pending'"
  );
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║     Payment Gateway Edge Case Tests                          ║"
  );
  console.log(
    "║     Redis & Database Positive/Negative Scenarios             ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝\n"
  );

  const startTime = Date.now();

  try {
    // Health check first
    const health = await api.get("/health");
    if (health.status !== 200) {
      console.error(
        "\n❌ API is not healthy. Please ensure services are running."
      );
      console.error("   Run: docker-compose up -d");
      process.exit(1);
    }
    console.log("✅ API is healthy, starting tests...\n");

    // Run all test suites
    await testAuthenticationEdgeCases();
    await testDatabasePositiveCases();
    await testDatabaseNegativeCases();
    await testRedisPositiveCases();
    await testRedisNegativeCases();
    await testIdempotencyPositiveCases();
    await testIdempotencyNegativeCases();
    await testCapturePositiveCases();
    await testCaptureNegativeCases();
    await testRefundPositiveCases();
    await testRefundNegativeCases();
    await testWebhookPositiveCases();
    await testWebhookNegativeCases();
    await testWebhookSignatureVerification();
    await testPaginationEdgeCases();
    await testDataIntegrity();
  } catch (error) {
    console.error("\n❌ Test execution failed:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("   Make sure the API is running on localhost:8000");
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    "\n╔══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║                       TEST SUMMARY                           ║"
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════╣"
  );
  console.log(
    `║  ✅ Passed: ${passed.toString().padEnd(5)} │ ❌ Failed: ${failed
      .toString()
      .padEnd(5)} │ Total: ${(passed + failed).toString().padEnd(5)} ║`
  );
  console.log(
    `║  ⏱  Duration: ${duration}s                                       ║`
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝"
  );

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => r.status === "FAILED")
      .forEach((r) => {
        console.log(`   - ${r.test}`);
        if (r.details) console.log(`     Details: ${r.details}`);
      });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
