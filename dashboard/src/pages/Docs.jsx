import React from "react";

function Docs() {
  return (
    <div data-test-id="api-docs">
      <h2 className="text-3xl font-bold text-black mb-8">Integration Guide</h2>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-create-order">
        <h3 className="text-xl font-bold text-black mb-4">1. Create Order</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-create-order">
          <code>{`curl -X POST http://localhost:8000/api/v1/orders \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-create-payment">
        <h3 className="text-xl font-bold text-black mb-4">2. Create Payment</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-create-payment">
          <code>{`curl -X POST http://localhost:8000/api/v1/payments \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique_request_id_123" \\
  -d '{
    "order_id": "order_NXhj67fGH2jk9mPq",
    "method": "upi",
    "vpa": "user@paytm"
  }'`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-sdk-integration">
        <h3 className="text-xl font-bold text-black mb-4">3. SDK Integration</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-sdk">
          <code>{`<script src="http://localhost:3001/checkout.js"></script>
<script>
const checkout = new PaymentGateway({
  key: 'key_test_abc123',
  orderId: 'order_xyz',
  onSuccess: (response) => {
    console.log('Payment ID:', response.paymentId);
  },
  onFailure: (error) => {
    console.error('Payment failed:', error);
  },
  onClose: () => {
    console.log('Checkout closed');
  }
});
checkout.open();
</script>`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-webhook-verification">
        <h3 className="text-xl font-bold text-black mb-4">4. Verify Webhook Signature</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-webhook">
          <code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

// Express.js example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = verifyWebhook(req.body, signature, 'whsec_test_abc123');
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  console.log('Webhook verified:', req.body.event);
  res.status(200).send('OK');
});`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-refund">
        <h3 className="text-xl font-bold text-black mb-4">5. Create Refund</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-refund">
          <code>{`curl -X POST http://localhost:8000/api/v1/payments/pay_H8sK3jD9s2L1pQr/refunds \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "reason": "Customer requested refund"
  }'`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6" data-test-id="section-capture">
        <h3 className="text-xl font-bold text-black mb-4">6. Capture Payment</h3>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm" data-test-id="code-snippet-capture">
          <code>{`curl -X POST http://localhost:8000/api/v1/payments/pay_H8sK3jD9s2L1pQr/capture \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000
  }'`}</code>
        </pre>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6" data-test-id="section-webhook-events">
        <h3 className="text-xl font-bold text-black mb-4">7. Webhook Events</h3>
        <p className="text-gray-600 mb-4">The following webhook events are emitted:</p>
        <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded">payment.created</code> - When payment record is created</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">payment.pending</code> - When payment enters pending state</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">payment.success</code> - When payment succeeds</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">payment.failed</code> - When payment fails</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">refund.created</code> - When refund is initiated</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded">refund.processed</code> - When refund completes</li>
        </ul>
        <pre className="bg-black text-white p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`// Webhook payload example
{
  "event": "payment.success",
  "timestamp": 1705315870,
  "data": {
    "payment": {
      "id": "pay_H8sK3jD9s2L1pQr",
      "order_id": "order_NXhj67fGH2jk9mPq",
      "amount": 50000,
      "currency": "INR",
      "method": "upi",
      "vpa": "user@paytm",
      "status": "success",
      "created_at": "2024-01-15T10:31:00Z"
    }
  }
}`}</code>
        </pre>
      </section>
    </div>
  );
}

export default Docs;
