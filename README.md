# Payment Gateway 

A production-ready payment gateway system with asynchronous job processing, webhook delivery, embeddable JavaScript SDK, and refund management.

## Features

- **Asynchronous Payment Processing**: Redis-based job queues with BullMQ workers
- **Webhook System**: HMAC-SHA256 signature verification with automatic retry logic (5 attempts with exponential backoff)
- **Embeddable JavaScript SDK**: Modal/iframe integration without redirects
- **Refund API**: Full and partial refund support, processed asynchronously
- **Idempotency Keys**: Prevents duplicate charges on network retries
- **Enhanced Dashboard**: Webhook configuration, delivery logs, manual retry, and API documentation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├──────────────┬──────────────┬────────────────┬─────────────────┤
│   Dashboard  │   Checkout   │  Merchant App  │   SDK Widget    │
│   (3000)     │    (3001)    │                │                 │
└──────┬───────┴──────┬───────┴────────┬───────┴─────────────────┤
       │              │                │                          │
       └──────────────┴────────────────┘                          │
                      │                                           │
              ┌───────▼───────┐                                   │
              │   API Server  │◄──────────────────────────────────┘
              │    (8000)     │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐   ┌───────────┐   ┌───────────┐
│ PostgreSQL│   │   Redis   │   │  Worker   │
│  (5432)   │   │  (6379)   │   │  Service  │
└───────────┘   └───────────┘   └───────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Start the Application

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Services

| Service   | Port  | Description                    |
|-----------|-------|--------------------------------|
| API       | 8000  | Backend REST API               |
| Dashboard | 3000  | Merchant Dashboard (React)     |
| Checkout  | 3001  | Checkout Widget & SDK          |
| PostgreSQL| 5432  | Database                       |
| Redis     | 6379  | Job Queue                      |

## API Documentation

### Authentication

All API requests require authentication headers:

```
X-Api-Key: key_test_abc123
X-Api-Secret: secret_test_xyz789
```

### Endpoints

#### Orders

```bash
# Create Order
POST /api/v1/orders
{
  "amount": 50000,
  "currency": "INR",
  "receipt": "receipt_123"
}

# Get Order
GET /api/v1/orders/{order_id}
```

#### Payments

```bash
# Create Payment
POST /api/v1/payments
Headers: Idempotency-Key: unique_request_id (optional)
{
  "order_id": "order_xyz",
  "method": "upi",
  "vpa": "user@paytm"
}

# Get Payment
GET /api/v1/payments/{payment_id}

# Capture Payment
POST /api/v1/payments/{payment_id}/capture
{
  "amount": 50000
}
```

#### Refunds

```bash
# Create Refund
POST /api/v1/payments/{payment_id}/refunds
{
  "amount": 25000,
  "reason": "Customer requested refund"
}

# Get Refund
GET /api/v1/refunds/{refund_id}
```

#### Webhooks

```bash
# List Webhook Logs
GET /api/v1/webhooks?limit=10&offset=0

# Retry Webhook
POST /api/v1/webhooks/{webhook_id}/retry
```

#### Job Status (Test Endpoint)

```bash
GET /api/v1/test/jobs/status
```

## SDK Integration

### Include the SDK

```html
<script src="http://localhost:3001/checkout.js"></script>
```

### Usage

```javascript
document.getElementById('pay-button').addEventListener('click', function() {
  const checkout = new PaymentGateway({
    key: 'key_test_abc123',
    orderId: 'order_xyz',
    onSuccess: function(response) {
      console.log('Payment successful:', response.paymentId);
    },
    onFailure: function(error) {
      console.log('Payment failed:', error);
    },
    onClose: function() {
      console.log('Checkout closed');
    }
  });
  
  checkout.open();
});
```

## Webhook Integration

### Webhook Events

- `payment.success` - Payment succeeded
- `payment.failed` - Payment failed
- `refund.processed` - Refund completed

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}
```

### Webhook Payload Example

```json
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
      "status": "success"
    }
  }
}
```

## Test Merchant Credentials

```
API Key: key_test_abc123
API Secret: secret_test_xyz789
Webhook Secret: whsec_test_abc123
```

## Environment Variables

### API Service

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | - |
| REDIS_URL | Redis connection string | - |
| TEST_MODE | Enable deterministic processing | false |
| TEST_PROCESSING_DELAY | Delay in ms for test mode | 1000 |
| TEST_PAYMENT_SUCCESS | Force payment success in test mode | true |
| WEBHOOK_RETRY_INTERVALS_TEST | Use shorter retry intervals | false |

## Database Schema

### Tables

- **merchants**: Merchant accounts with API credentials
- **orders**: Customer orders
- **payments**: Payment transactions
- **refunds**: Refund records
- **webhook_logs**: Webhook delivery history
- **idempotency_keys**: Request deduplication

## Retry Logic

### Webhook Delivery

| Attempt | Delay (Production) | Delay (Test) |
|---------|-------------------|--------------|
| 1 | Immediate | Immediate |
| 2 | 1 minute | 5 seconds |
| 3 | 5 minutes | 10 seconds |
| 4 | 30 minutes | 15 seconds |
| 5 | 2 hours | 20 seconds |

After 5 failed attempts, webhook is marked as permanently failed.

### Demo Vedio Link : https://drive.google.com/file/d/1Vf7dYLgDQCirwJOh7gG6EsHq_2ZvO-jm/view?usp=sharing






