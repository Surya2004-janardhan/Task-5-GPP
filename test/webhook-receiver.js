/**
 * Test Merchant Webhook Receiver
 * Receives and verifies webhook deliveries from the Payment Gateway
 */

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "whsec_test_abc123";

// Store received webhooks
const receivedWebhooks = [];

// Raw body parser for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Webhook verification function
function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return signature === expectedSignature;
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", webhooks_received: receivedWebhooks.length });
});

// Get received webhooks
app.get("/webhooks", (req, res) => {
  res.json({
    count: receivedWebhooks.length,
    webhooks: receivedWebhooks,
  });
});

// Clear received webhooks
app.delete("/webhooks", (req, res) => {
  receivedWebhooks.length = 0;
  res.json({ message: "Webhooks cleared" });
});

// Main webhook endpoint
app.post("/webhook", (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const payload = req.rawBody;
  const timestamp = new Date().toISOString();

  console.log("\n═══════════════════════════════════════════");
  console.log("📥 WEBHOOK RECEIVED");
  console.log("═══════════════════════════════════════════");
  console.log(`Time: ${timestamp}`);
  console.log(`Event: ${req.body.event}`);
  console.log(
    `Signature: ${signature ? signature.substring(0, 32) + "..." : "MISSING"}`
  );

  // Verify signature
  const isValid = verifyWebhookSignature(payload, signature, WEBHOOK_SECRET);

  if (!isValid) {
    console.log("❌ SIGNATURE VERIFICATION FAILED");
    console.log(`Expected secret: ${WEBHOOK_SECRET}`);

    // Calculate what we expect
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");
    console.log(`Expected signature: ${expectedSignature.substring(0, 32)}...`);
    console.log(
      `Received signature: ${
        signature ? signature.substring(0, 32) + "..." : "NONE"
      }`
    );

    receivedWebhooks.push({
      timestamp,
      event: req.body.event,
      valid: false,
      error: "Invalid signature",
    });

    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("✅ SIGNATURE VERIFIED");
  console.log("Payload:", JSON.stringify(req.body, null, 2));

  receivedWebhooks.push({
    timestamp,
    event: req.body.event,
    valid: true,
    data: req.body.data,
  });

  res.status(200).json({ received: true, event: req.body.event });
});

// Failing webhook endpoint (for testing retries)
let failCount = 0;
app.post("/webhook/fail", (req, res) => {
  failCount++;
  console.log(`\n❌ Webhook fail endpoint hit (attempt ${failCount})`);

  if (failCount < 3) {
    res.status(500).json({ error: "Simulated failure" });
  } else {
    console.log("✅ Now accepting webhooks after 3 failures");
    failCount = 0;
    res.status(200).json({ received: true });
  }
});

// Slow webhook endpoint (for testing timeouts)
app.post("/webhook/slow", async (req, res) => {
  console.log("\n⏳ Slow webhook endpoint - waiting 10 seconds...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║     Test Merchant Webhook Receiver                    ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(`\nListening on port ${PORT}`);
  console.log(`Webhook secret: ${WEBHOOK_SECRET}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /webhook        - Main webhook receiver`);
  console.log(`  POST /webhook/fail   - Fails first 2 attempts`);
  console.log(`  POST /webhook/slow   - 10 second delay`);
  console.log(`  GET  /webhooks       - List received webhooks`);
  console.log(`  DELETE /webhooks     - Clear webhooks`);
  console.log(`  GET  /health         - Health check`);
  console.log(`\nConfigure your webhook URL to:`);
  console.log(`  Windows/Mac: http://host.docker.internal:${PORT}/webhook`);
  console.log(`  Linux: http://172.17.0.1:${PORT}/webhook`);
  console.log("");
});
