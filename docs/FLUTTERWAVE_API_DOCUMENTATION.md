# Flutterwave Wallet Funding API Documentation

## Overview

This document provides comprehensive documentation for the Flutterwave wallet funding system in the StarkTol VTU platform. The system allows users to fund their wallets using various payment methods supported by Flutterwave.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Authentication](#authentication)
3. [Request/Response Format](#requestresponse-format)
4. [Payment Flow](#payment-flow)
5. [Webhook Integration](#webhook-integration)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Environment Configuration](#environment-configuration)

## API Endpoints

### Base URL
```
Production: https://api.mystarktol.com/api/v1
Development: http://localhost:8000/api/v1
```

### Authentication
All API endpoints require authentication via Bearer token:
```http
Authorization: Bearer <your_jwt_token>
```

---

## 1. Initiate Payment

Create a Flutterwave payment link for wallet funding.

**Endpoint:** `POST /payment/initiate`

**Request Body:**
```json
{
  "amount": 1000,
  "redirect_url": "https://yourapp.com/payment/success" // Optional
}
```

**Request Validation:**
- `amount`: Number, required, min: 100, max: 1,000,000
- `redirect_url`: String, optional, must be valid URL

**Response:**
```json
{
  "success": true,
  "message": "Payment link created successfully",
  "data": {
    "paymentLink": "https://checkout.flutterwave.com/v3/hosted/pay/abc123",
    "txRef": "starktol_user123_1640995200000_456",
    "amount": 1000,
    "transaction": {
      "id": "uuid",
      "status": "pending",
      "created_at": "2023-12-31T15:30:00Z"
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Minimum payment amount is ₦100"
}
```

---

## 2. Payment Verification

Verify payment status after user completes payment.

**Endpoint:** `POST /payment/verify`

**Request Body:**
```json
{
  "tx_ref": "starktol_user123_1640995200000_456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "txRef": "starktol_user123_1640995200000_456",
    "status": "success",
    "amount": 1000,
    "newBalance": 5000
  }
}
```

**Response (Failed):**
```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

---

## 3. Get Payment Status

Check the current status of a payment.

**Endpoint:** `GET /payment/status/:tx_ref`

**Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved",
  "data": {
    "txRef": "starktol_user123_1640995200000_456",
    "status": "completed",
    "amount": 1000,
    "createdAt": "2023-12-31T15:30:00Z",
    "updatedAt": "2023-12-31T15:32:00Z",
    "transaction": {
      "id": "uuid",
      "status": "completed",
      "balance_after": 5000
    },
    "flwRef": "FLW-REF-12345"
  }
}
```

---

## 4. Get Wallet Balance

Retrieve current wallet balance.

**Endpoint:** `GET /wallet` or `GET /wallet/balance`

**Response:**
```json
{
  "success": true,
  "message": "Wallet retrieved successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "balance": "5000.00",
    "total_deposits": "10000.00",
    "total_withdrawals": "5000.00",
    "currency": "NGN",
    "is_frozen": false,
    "created_at": "2023-12-01T10:00:00Z",
    "updated_at": "2023-12-31T15:32:00Z"
  }
}
```

---

## 5. Fund Wallet (Alternative Method)

Alternative endpoint for wallet funding.

**Endpoint:** `POST /wallet/fund`

**Request Body:**
```json
{
  "amount": 1000,
  "method": "flutterwave",
  "metadata": {
    "redirectUrl": "https://yourapp.com/success"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment link created successfully",
  "data": {
    "paymentLink": "https://checkout.flutterwave.com/v3/hosted/pay/abc123",
    "txRef": "starktol_user123_1640995200000_456",
    "amount": 1000,
    "method": "flutterwave"
  }
}
```

---

## Payment Flow

### Complete Payment Process

1. **User initiates payment:**
   ```http
   POST /api/v1/payment/initiate
   {
     "amount": 1000
   }
   ```

2. **System creates payment link:**
   - Generates unique transaction reference
   - Creates payment log in database
   - Returns Flutterwave checkout URL

3. **User redirected to Flutterwave:**
   - User completes payment using preferred method
   - Flutterwave processes payment

4. **Payment completion (2 methods):**
   
   **Method A: Webhook (Automatic)**
   - Flutterwave sends webhook to `/webhook/flutterwave`
   - System verifies payment and credits wallet
   - Real-time notifications sent to user

   **Method B: Callback Verification (Manual)**
   - User redirected back to success page
   - Frontend calls `/payment/verify` with tx_ref
   - System verifies with Flutterwave and credits wallet

5. **Wallet updated:**
   - Balance increased
   - Transaction recorded
   - Real-time updates sent

### Payment States

| Status | Description |
|--------|-------------|
| `initiated` | Payment link created |
| `pending` | User redirected to Flutterwave |
| `processing` | Payment being processed |
| `completed` | Payment successful, wallet credited |
| `failed` | Payment failed |
| `cancelled` | Payment cancelled by user |
| `expired` | Payment link expired |

---

## Webhook Integration

### Webhook Endpoint

**URL:** `POST /webhook/flutterwave`

**Security:** Webhook signature verification using `verif-hash` header

**Supported Events:**
- `charge.completed` - Payment completed successfully

**Webhook Payload Example:**
```json
{
  "event": "charge.completed",
  "data": {
    "id": 1234567,
    "tx_ref": "starktol_user123_1640995200000_456",
    "flw_ref": "FLW-REF-12345",
    "amount": 1000,
    "currency": "NGN",
    "status": "successful",
    "payment_type": "card",
    "customer": {
      "id": 12345,
      "email": "user@example.com",
      "name": "John Doe"
    },
    "meta": {
      "user_id": "uuid",
      "source": "wallet_funding"
    }
  }
}
```

**Webhook Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "eventId": "webhook_1640995200000",
  "processingTimeMs": 245
}
```

### Webhook Security

1. **Signature Verification:**
   ```javascript
   const hash = crypto
     .createHmac('sha256', process.env.FLW_WEBHOOK_HASH)
     .update(JSON.stringify(payload))
     .digest('hex');
   
   const isValid = hash === req.headers['verif-hash'];
   ```

2. **Idempotency:**
   - Webhooks are processed only once
   - Duplicate webhooks return success without processing

3. **Error Handling:**
   - Failed webhooks are logged with error details
   - Retry mechanism for transient failures

---

## Error Handling

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_AMOUNT | Amount below minimum or above maximum |
| 400 | INVALID_REQUEST | Invalid request format or missing fields |
| 401 | UNAUTHORIZED | Invalid or missing authentication token |
| 404 | PAYMENT_NOT_FOUND | Payment record not found |
| 409 | ALREADY_PROCESSED | Payment already processed |
| 422 | VALIDATION_ERROR | Request validation failed |
| 500 | INTERNAL_ERROR | Server error |
| 502 | FLUTTERWAVE_ERROR | Flutterwave API error |

### Error Response Format

```json
{
  "success": false,
  "message": "Minimum payment amount is ₦100",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be at least 100"
    }
  ],
  "code": "INVALID_AMOUNT",
  "timestamp": "2023-12-31T15:30:00Z"
}
```

---

## Testing

### Test Environment

**Base URL:** `http://localhost:8000/api/v1`

**Test Cards (Flutterwave Sandbox):**

**Successful Payment:**
```
Card Number: 5531886652142950
CVV: 564
Expiry: 09/32
PIN: 3310
```

**Failed Payment:**
```
Card Number: 5840406187553286
CVV: 564
Expiry: 09/32
PIN: 3310
```

### Testing Workflow

1. **Setup Test Environment:**
   ```bash
   # Set environment variables
   export FLW_PUBLIC_KEY=FLWPUBK_TEST-xxxxx
   export FLW_SECRET_KEY=FLWSECK_TEST-xxxxx
   export FLW_ENCRYPTION_KEY=FLWSECK_TESTxxxxx
   ```

2. **Test Payment Initiation:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/payment/initiate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"amount": 1000}'
   ```

3. **Test Webhook:**
   - Use ngrok to expose local server
   - Configure webhook URL in Flutterwave dashboard
   - Complete test payment and verify webhook processing

### Webhook Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 8000

# Update Flutterwave webhook URL to:
# https://abc123.ngrok.io/webhook/flutterwave
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Flutterwave Configuration
FLW_PUBLIC_KEY=FLWPUBK_TEST-your_public_key
FLW_SECRET_KEY=FLWSECK_TEST-your_secret_key  
FLW_ENCRYPTION_KEY=FLWSECK_TEST-your_encryption_key
FLW_WEBHOOK_HASH=your_webhook_hash

# Application URLs
FRONTEND_URL=http://localhost:8000
BASE_URL=http://localhost:8000

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Production Checklist

- [ ] Replace test keys with live keys
- [ ] Configure production webhook URL (HTTPS required)
- [ ] Set up SSL certificate
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Test failure scenarios

---

## Rate Limiting

### Default Limits

| Endpoint | Rate Limit | Window |
|----------|------------|---------|
| `/payment/initiate` | 10 per minute | 1 minute |
| `/payment/verify` | 30 per minute | 1 minute |
| `/webhook/flutterwave` | 100 per minute | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995260
```

---

## Real-time Updates

### Supabase Integration

The system uses Supabase real-time subscriptions for live updates:

```javascript
// Frontend subscription
const subscription = supabase
  .from('wallets')
  .on('UPDATE', payload => {
    updateWalletBalance(payload.new.balance);
  })
  .subscribe();
```

### WebSocket Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `wallet_balance_updated` | Successful payment | `{balance, amount, txRef}` |
| `payment_completed` | Webhook processed | `{txRef, amount, status}` |
| `notification` | Various events | `{title, message, type, data}` |

---

## Database Schema

### Key Tables

1. **wallets** - User wallet information
2. **payment_logs** - Payment tracking
3. **transactions** - Transaction history
4. **flutterwave_webhooks** - Webhook tracking

### Indexes

Performance-optimized indexes on:
- `wallets.user_id`
- `payment_logs.tx_ref`
- `transactions.payment_reference`
- `flutterwave_webhooks.tx_ref`

---

## Support and Troubleshooting

### Common Issues

1. **Payment not credited:**
   - Check webhook logs
   - Verify transaction in payment_logs table
   - Check Flutterwave dashboard

2. **Duplicate payments:**
   - System prevents duplicates using tx_ref
   - Check transaction_processed function

3. **Webhook not received:**
   - Verify webhook URL configuration
   - Check server logs for errors
   - Ensure HTTPS in production

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=debug
export NODE_ENV=development
```

### Monitoring

Key metrics to monitor:
- Payment success rate
- Webhook processing time
- Failed payment reasons
- Wallet funding volume

---

## Security Considerations

1. **Webhook Signature Verification:** Always verify webhook signatures
2. **Input Validation:** Validate all inputs on server side
3. **Rate Limiting:** Prevent abuse with rate limiting
4. **Logging:** Log all payment activities for audit
5. **Error Handling:** Don't expose sensitive information in errors
6. **HTTPS:** Use HTTPS in production
7. **Environment Variables:** Never commit secrets to code

---

## API Client Examples

### JavaScript (Node.js)

```javascript
const axios = require('axios');

class StarkTolPaymentClient {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async initiatePayment(amount, redirectUrl) {
    const response = await this.client.post('/payment/initiate', {
      amount,
      redirect_url: redirectUrl
    });
    return response.data;
  }

  async verifyPayment(txRef) {
    const response = await this.client.post('/payment/verify', {
      tx_ref: txRef
    });
    return response.data;
  }

  async getWalletBalance() {
    const response = await this.client.get('/wallet/balance');
    return response.data;
  }
}

// Usage
const client = new StarkTolPaymentClient(
  'https://api.mystarktol.com/api/v1',
  'your_jwt_token'
);

const payment = await client.initiatePayment(1000);
console.log('Payment URL:', payment.data.paymentLink);
```

### cURL Examples

```bash
# Initiate Payment
curl -X POST https://api.mystarktol.com/api/v1/payment/initiate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}'

# Verify Payment  
curl -X POST https://api.mystarktol.com/api/v1/payment/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tx_ref": "starktol_user123_1640995200000_456"}'

# Get Wallet Balance
curl -X GET https://api.mystarktol.com/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

This documentation provides a complete reference for integrating with the StarkTol VTU Flutterwave wallet funding system. For additional support, please contact the development team or refer to the Flutterwave API documentation.
