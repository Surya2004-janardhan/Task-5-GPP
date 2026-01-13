/**
 * Simple End-to-End Test for Payment Gateway
 * Tests all core functionalities
 */

const axios = require("axios");

const API_URL = "http://localhost:8000";
const CHECKOUT_URL = "http://localhost:3001";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "X-Api-Key": "key_test_abc123",
    "X-Api-Secret": "secret_test_xyz789",
    "Content-Type": "application/json",
  },
  validateStatus: () => true,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function test(name, fn) {
  try {
    const result = await fn();
    if (result) {
      console.log("\x1b[32m✓\x1b[0m " + name);
      return true;
    } else {
      console.log("\x1b[31m✗\x1b[0m " + name);
      return false;
    }
  } catch (e) {
    console.log("\x1b[31m✗\x1b[0m " + name + " - " + e.message);
    return false;
  }
}

async function main() {
  console.log("\n=== Payment Gateway Simple E2E Test ===\n");

  let passed = 0;
  let total = 0;

  // 1. Health Checks
  console.log("Health Checks:");
  if (
    await test("API health", async () => {
      const r = await api.get("/health");
      return r.status === 200 && r.data.status === "healthy";
    })
  )
    passed++;
  total++;

  if (
    await test("Job queue status", async () => {
      const r = await axios.get(`${API_URL}/api/v1/test/jobs/status`);
      return r.data.worker_status === "running";
    })
  )
    passed++;
  total++;

  if (
    await test("Checkout SDK served", async () => {
      const r = await axios.get(`${CHECKOUT_URL}/checkout.js`);
      return r.status === 200 && r.data.includes("PaymentGateway");
    })
  )
    passed++;
  total++;

  // 2. Orders
  console.log("\nOrders:");
  let orderId;
  if (
    await test("Create order", async () => {
      const r = await api.post("/api/v1/orders", {
        amount: 100000,
        currency: "INR",
        receipt: "test",
      });
      orderId = r.data.id;
      return r.status === 201 && orderId.startsWith("order_");
    })
  )
    passed++;
  total++;

  if (
    await test("Get order", async () => {
      const r = await api.get(`/api/v1/orders/${orderId}`);
      return r.status === 200 && r.data.id === orderId;
    })
  )
    passed++;
  total++;

  // 3. Payments
  console.log("\nPayments:");
  let paymentId;
  if (
    await test("Create UPI payment", async () => {
      const r = await api.post("/api/v1/payments", {
        order_id: orderId,
        method: "upi",
        vpa: "test@upi",
      });
      paymentId = r.data.id;
      return r.status === 201 && r.data.status === "pending";
    })
  )
    passed++;
  total++;

  if (
    await test("Get payment", async () => {
      const r = await api.get(`/api/v1/payments/${paymentId}`);
      return r.status === 200 && r.data.captured !== undefined;
    })
  )
    passed++;
  total++;

  // 4. Idempotency
  console.log("\nIdempotency:");
  if (
    await test("Idempotency key returns same payment", async () => {
      const o = await api.post("/api/v1/orders", {
        amount: 5000,
        currency: "INR",
      });
      const key = "idem_" + Date.now();
      const p1 = await api.post(
        "/api/v1/payments",
        { order_id: o.data.id, method: "upi", vpa: "test@upi" },
        { headers: { "Idempotency-Key": key } }
      );
      const p2 = await api.post(
        "/api/v1/payments",
        { order_id: o.data.id, method: "upi", vpa: "test@upi" },
        { headers: { "Idempotency-Key": key } }
      );
      return p1.data.id === p2.data.id;
    })
  )
    passed++;
  total++;

  // 5. Merchant Endpoints
  console.log("\nMerchant:");
  if (
    await test("Get merchant profile", async () => {
      const r = await api.get("/api/v1/merchants/profile");
      return r.status === 200 && r.data.webhook_secret !== undefined;
    })
  )
    passed++;
  total++;

  if (
    await test("Update webhook URL", async () => {
      const r = await api.put("/api/v1/merchants/webhook", {
        webhook_url: "http://test.com/webhook",
      });
      return r.status === 200;
    })
  )
    passed++;
  total++;

  if (
    await test("Regenerate webhook secret", async () => {
      const r = await api.post("/api/v1/merchants/webhook/regenerate-secret");
      return r.status === 200 && r.data.webhook_secret.startsWith("whsec_");
    })
  )
    passed++;
  total++;

  // 6. Webhook Logs
  console.log("\nWebhook Logs:");
  if (
    await test("List webhook logs", async () => {
      const r = await api.get("/api/v1/webhooks?limit=10");
      return r.status === 200 && Array.isArray(r.data.data);
    })
  )
    passed++;
  total++;

  // 7. Card Payment
  console.log("\nCard Payment:");
  if (
    await test("Create card payment", async () => {
      const o = await api.post("/api/v1/orders", {
        amount: 3000,
        currency: "INR",
      });
      const r = await api.post("/api/v1/payments", {
        order_id: o.data.id,
        method: "card",
        card_number: "4111111111111111",
        card_expiry: "12/25",
        card_cvv: "123",
      });
      return r.status === 201 && r.data.card_last4 === "1111";
    })
  )
    passed++;
  total++;

  // 8. Wait for payment and test refund
  console.log("\nAsync Processing & Refund:");
  console.log("  Waiting for payment processing (15s)...");
  await sleep(15000);

  const check = await api.get(`/api/v1/payments/${paymentId}`);
  const status = check.data.status;
  console.log(`  Payment status: ${status}`);

  if (status === "success") {
    if (
      await test("Capture payment", async () => {
        const r = await api.post(`/api/v1/payments/${paymentId}/capture`, {
          amount: 100000,
        });
        return r.status === 200 && r.data.captured === true;
      })
    )
      passed++;
    total++;

    let refundId;
    if (
      await test("Create partial refund", async () => {
        const r = await api.post(`/api/v1/payments/${paymentId}/refunds`, {
          amount: 30000,
          reason: "Test",
        });
        refundId = r.data.id;
        return r.status === 201 && r.data.status === "pending";
      })
    )
      passed++;
    total++;

    console.log("  Waiting for refund processing (6s)...");
    await sleep(6000);

    if (
      await test("Refund processed", async () => {
        const r = await api.get(`/api/v1/refunds/${refundId}`);
        return r.data.status === "processed";
      })
    )
      passed++;
    total++;

    if (
      await test("Exceeding refund rejected", async () => {
        const r = await api.post(`/api/v1/payments/${paymentId}/refunds`, {
          amount: 100000,
          reason: "Fail",
        });
        return r.status === 400;
      })
    )
      passed++;
    total++;
  } else {
    console.log("  Payment failed, skipping capture/refund tests");
    total += 4;
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
