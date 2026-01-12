/**
 * Test Merchant Webhook Receiver
 * Run this to test webhook delivery from the payment gateway
 *
 * Usage: node webhook-receiver.js
 */

const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = "whsec_test_abc123";
const PORT = 4000;

// Verify webhook signature
function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return signature === expectedSignature;
}

// Webhook endpoint
app.post("/webhook", (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const payload = req.body;

  console.log("\n" + "=".repeat(50));
  console.log("📥 Webhook Received");
  console.log("=".repeat(50));
  console.log("Event:", payload.event);
  console.log("Timestamp:", new Date(payload.timestamp * 1000).toISOString());
  console.log("Signature:", signature);

  // Verify signature
  const isValid = verifyWebhook(payload, signature, WEBHOOK_SECRET);

  if (!isValid) {
    console.log("❌ Invalid signature!");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ Signature verified");
  console.log("\nPayload:");
  console.log(JSON.stringify(payload, null, 2));

  // Simulate processing
  if (payload.event === "payment.success") {
    console.log("\n🎉 Payment successful!");
    console.log("Payment ID:", payload.data.payment.id);
    console.log(
      "Amount:",
      payload.data.payment.amount / 100,
      payload.data.payment.currency
    );
  } else if (payload.event === "payment.failed") {
    console.log("\n❌ Payment failed");
    console.log("Payment ID:", payload.data.payment.id);
    console.log("Error:", payload.data.payment.error_description);
  } else if (payload.event === "refund.processed") {
    console.log("\n💰 Refund processed");
    console.log("Refund ID:", payload.data.refund.id);
    console.log("Amount:", payload.data.refund.amount / 100);
  }

  console.log("=".repeat(50) + "\n");

  res.status(200).json({ received: true });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(PORT, () => {
  console.log("🚀 Test Merchant Webhook Receiver");
  console.log("=".repeat(50));
  console.log(`Listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`Docker URL: http://host.docker.internal:${PORT}/webhook`);
  console.log("=".repeat(50));
  console.log("\nWaiting for webhooks...\n");
});
