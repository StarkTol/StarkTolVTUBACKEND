# Flutterwave Wallet Funding - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the Flutterwave wallet funding system in the StarkTol VTU platform. It covers unit tests, integration tests, and end-to-end testing scenarios.

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Environment Configuration](#environment-configuration)
3. [Backend Testing](#backend-testing)
4. [Frontend Testing](#frontend-testing)
5. [Integration Testing](#integration-testing)
6. [Webhook Testing](#webhook-testing)
7. [Test Scenarios](#test-scenarios)
8. [Performance Testing](#performance-testing)
9. [Security Testing](#security-testing)
10. [Troubleshooting](#troubleshooting)

## Pre-Testing Setup

### 1. Run Setup Script

First, ensure your system is properly configured:

```bash
# Navigate to backend directory
cd StarkTolVTUBACKEND

# Run the setup script
node scripts/setup-flutterwave.js --create-schema --create-sample

# Verify environment
node scripts/setup-flutterwave.js --health-check
```

### 2. Environment Variables

Ensure these test environment variables are set:

```bash
# Test Keys (Flutterwave Sandbox)
FLW_PUBLIC_KEY=FLWPUBK_TEST-your_test_public_key
FLW_SECRET_KEY=FLWSECK_TEST-your_test_secret_key
FLW_ENCRYPTION_KEY=FLWSECK_TEST-your_test_encryption_key
FLW_WEBHOOK_HASH=your_test_webhook_hash

# Test URLs
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:8000

# Database (Test instance recommended)
SUPABASE_URL=your_test_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
```

### 3. Start Services

```bash
# Start backend server
npm run dev

# Start frontend (in separate terminal)
cd ../StarkTolVTUFRONTEND
npm run dev
```

## Environment Configuration

### Test Card Details

**Successful Payment:**
```
Card Number: 5531886652142950
CVV: 564
Expiry: 09/32
PIN: 3310
OTP: 12345
```

**Failed Payment:**
```
Card Number: 5840406187553286
CVV: 564
Expiry: 09/32
PIN: 3310
```

**Insufficient Funds:**
```
Card Number: 5531886652142961
CVV: 564
Expiry: 09/32
PIN: 3310
```

### Webhook Testing Setup

```bash
# Install ngrok for webhook testing
npm install -g ngrok

# Expose local server
ngrok http 8000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Configure in Flutterwave Dashboard:
# Webhook URL: https://abc123.ngrok.io/webhook/flutterwave
```

## Backend Testing

### 1. API Endpoint Tests

#### Test Payment Initiation

```bash
# Test valid payment initiation
curl -X POST http://localhost:8000/api/v1/payment/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 1000,
    "redirect_url": "http://localhost:3000/dashboard/wallet/fund/success"
  }'

# Expected Response:
# {
#   "success": true,
#   "message": "Payment link created successfully",
#   "data": {
#     "paymentLink": "https://checkout.flutterwave.com/v3/hosted/pay/...",
#     "txRef": "starktol_...",
#     "amount": 1000
#   }
# }
```

#### Test Amount Validation

```bash
# Test minimum amount validation
curl -X POST http://localhost:8000/api/v1/payment/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"amount": 50}'

# Expected Response:
# {
#   "success": false,
#   "message": "Minimum payment amount is ₦100"
# }
```

#### Test Payment Verification

```bash
# Test payment verification
curl -X POST http://localhost:8000/api/v1/payment/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"tx_ref": "your_transaction_reference"}'
```

#### Test Wallet Balance

```bash
# Test wallet balance retrieval
curl -X GET http://localhost:8000/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected Response:
# {
#   "success": true,
#   "message": "Wallet retrieved successfully",
#   "data": {
#     "balance": "0.00",
#     "currency": "NGN"
#   }
# }
```

### 2. Service Tests

Create test files for services:

#### Test Flutterwave Service

```javascript
// tests/services/flutterwaveService.test.js
const { flutterwaveService } = require('../../services/flutterwaveService');

describe('FlutterwaveService', () => {
  test('should generate unique transaction reference', () => {
    const txRef1 = flutterwaveService.generateTxRef('user123');
    const txRef2 = flutterwaveService.generateTxRef('user123');
    
    expect(txRef1).toMatch(/^starktol_user123_\d+_\d+$/);
    expect(txRef1).not.toBe(txRef2);
  });

  test('should create payment link', async () => {
    const paymentData = {
      amount: 1000,
      userId: 'test-user',
      userEmail: 'test@example.com',
      userName: 'Test User',
      userPhone: '+2348123456789'
    };

    const result = await flutterwaveService.createPaymentLink(paymentData);
    
    expect(result.success).toBe(true);
    expect(result.paymentLink).toContain('checkout.flutterwave.com');
    expect(result.txRef).toMatch(/^starktol_/);
  });

  test('should verify webhook signature', () => {
    const payload = { event: 'charge.completed', data: {} };
    const signature = 'mock_signature';
    
    // Mock process.env.FLW_WEBHOOK_HASH for test
    process.env.FLW_WEBHOOK_HASH = 'test_secret';
    
    const isValid = flutterwaveService.verifyWebhookSignature(signature, payload);
    expect(typeof isValid).toBe('boolean');
  });
});
```

#### Test Wallet Service

```javascript
// tests/services/walletService.test.js
const { walletService } = require('../../services/walletService');

describe('WalletService', () => {
  const testUserId = 'test-user-123';

  test('should create wallet for user', async () => {
    const wallet = await walletService.createWallet(testUserId);
    
    expect(wallet.user_id).toBe(testUserId);
    expect(wallet.balance).toBe('0.00');
    expect(wallet.currency).toBe('NGN');
  });

  test('should credit wallet', async () => {
    const amount = 1000;
    const description = 'Test credit';
    const txRef = 'test-tx-ref';

    const result = await walletService.creditWallet(
      testUserId, 
      amount, 
      description, 
      txRef
    );

    expect(result.success).toBe(true);
    expect(result.new_balance).toBe(1000);
  });

  test('should check transaction processed', async () => {
    const txRef = 'existing-tx-ref';
    const isProcessed = await walletService.isTransactionProcessed(txRef);
    
    expect(typeof isProcessed).toBe('boolean');
  });
});
```

### 3. Controller Tests

```javascript
// tests/controllers/paymentController.test.js
const request = require('supertest');
const app = require('../../index');

describe('PaymentController', () => {
  let authToken;

  beforeAll(async () => {
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.data.token;
  });

  test('POST /api/v1/payment/initiate - should create payment link', async () => {
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 1000,
        redirect_url: 'http://localhost:3000/success'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('paymentLink');
    expect(response.body.data).toHaveProperty('txRef');
  });

  test('POST /api/v1/payment/initiate - should reject invalid amount', async () => {
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 50 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Minimum payment amount');
  });

  test('GET /api/v1/wallet/balance - should return wallet balance', async () => {
    const response = await request(app)
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('balance');
    expect(response.body.data).toHaveProperty('currency');
  });
});
```

## Frontend Testing

### 1. Component Tests

```javascript
// StarkTolVTUFRONTEND/__tests__/components/FlutterwavePayment.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlutterwavePayment from '../../components/payments/FlutterwavePayment';

describe('FlutterwavePayment', () => {
  test('should render payment form', () => {
    render(<FlutterwavePayment />);
    
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByText(/proceed to payment/i)).toBeInTheDocument();
  });

  test('should validate minimum amount', async () => {
    render(<FlutterwavePayment />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByText(/proceed to payment/i);

    fireEvent.change(amountInput, { target: { value: '50' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/minimum amount is ₦100/i)).toBeInTheDocument();
    });
  });

  test('should initiate payment on valid form submission', async () => {
    const mockInitiatePayment = jest.fn().mockResolvedValue({
      success: true,
      data: {
        paymentLink: 'https://checkout.flutterwave.com/test',
        txRef: 'test-ref'
      }
    });

    // Mock API call
    jest.mock('../../lib/api/payment', () => ({
      initiatePayment: mockInitiatePayment
    }));

    render(<FlutterwavePayment />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByText(/proceed to payment/i);

    fireEvent.change(amountInput, { target: { value: '1000' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockInitiatePayment).toHaveBeenCalledWith({
        amount: 1000,
        redirect_url: expect.any(String)
      });
    });
  });
});
```

### 2. Integration Tests

```javascript
// StarkTolVTUFRONTEND/__tests__/integration/wallet-funding.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WalletFundingPage from '../../app/(dashboard)/dashboard/wallet/fund/page';

// Mock API
jest.mock('../../lib/api/payment');

describe('Wallet Funding Integration', () => {
  test('complete wallet funding flow', async () => {
    render(
      <BrowserRouter>
        <WalletFundingPage />
      </BrowserRouter>
    );

    // Step 1: Enter amount
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Step 2: Click proceed to payment
    const proceedButton = screen.getByText(/proceed to payment/i);
    fireEvent.click(proceedButton);

    // Step 3: Verify loading state
    await waitFor(() => {
      expect(screen.getByText(/creating payment link/i)).toBeInTheDocument();
    });

    // Step 4: Verify redirect (mocked)
    await waitFor(() => {
      expect(window.location.href).toContain('checkout.flutterwave.com');
    });
  });
});
```

## Integration Testing

### 1. End-to-End Payment Flow

```javascript
// tests/integration/payment-flow.test.js
const request = require('supertest');
const app = require('../../index');

describe('Payment Flow Integration', () => {
  let authToken;
  let userId;
  let txRef;

  beforeAll(async () => {
    // Setup test user and auth
    const user = await createTestUser();
    authToken = await getAuthToken(user);
    userId = user.id;
  });

  test('complete payment flow', async () => {
    // Step 1: Initiate payment
    const initiateResponse = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 1000 });

    expect(initiateResponse.status).toBe(200);
    txRef = initiateResponse.body.data.txRef;

    // Step 2: Simulate webhook
    const webhookPayload = {
      event: 'charge.completed',
      data: {
        id: 12345,
        tx_ref: txRef,
        flw_ref: 'FLW-REF-12345',
        amount: 1000,
        currency: 'NGN',
        status: 'successful',
        customer: {
          email: 'test@example.com',
          name: 'Test User'
        },
        meta: {
          user_id: userId,
          source: 'wallet_funding'
        }
      }
    };

    const webhookResponse = await request(app)
      .post('/webhook/flutterwave')
      .send(webhookPayload);

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.body.success).toBe(true);

    // Step 3: Verify wallet balance updated
    const balanceResponse = await request(app)
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceResponse.body.data.balance).toBe('1000.00');

    // Step 4: Verify transaction recorded
    const transactionResponse = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${authToken}`);

    const transaction = transactionResponse.body.data.find(
      t => t.payment_reference === txRef
    );

    expect(transaction).toBeDefined();
    expect(transaction.status).toBe('completed');
    expect(transaction.amount).toBe(1000);
  });
});
```

## Webhook Testing

### 1. Webhook Security Tests

```javascript
// tests/webhooks/security.test.js
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../index');

describe('Webhook Security', () => {
  test('should reject webhook with invalid signature', async () => {
    const payload = {
      event: 'charge.completed',
      data: { tx_ref: 'test-ref', amount: 1000, status: 'successful' }
    };

    const response = await request(app)
      .post('/webhook/flutterwave')
      .set('verif-hash', 'invalid-signature')
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid webhook signature');
  });

  test('should accept webhook with valid signature', async () => {
    const payload = {
      event: 'charge.completed',
      data: {
        tx_ref: 'test-ref',
        amount: 1000,
        status: 'successful',
        meta: { user_id: 'test-user' }
      }
    };

    // Generate valid signature
    const signature = crypto
      .createHmac('sha256', process.env.FLW_WEBHOOK_HASH)
      .update(JSON.stringify(payload))
      .digest('hex');

    const response = await request(app)
      .post('/webhook/flutterwave')
      .set('verif-hash', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should handle duplicate webhooks (idempotency)', async () => {
    const payload = {
      event: 'charge.completed',
      data: {
        tx_ref: 'duplicate-test-ref',
        amount: 1000,
        status: 'successful',
        meta: { user_id: 'test-user' }
      }
    };

    const signature = crypto
      .createHmac('sha256', process.env.FLW_WEBHOOK_HASH)
      .update(JSON.stringify(payload))
      .digest('hex');

    // First webhook
    const response1 = await request(app)
      .post('/webhook/flutterwave')
      .set('verif-hash', signature)
      .send(payload);

    // Second webhook (duplicate)
    const response2 = await request(app)
      .post('/webhook/flutterwave')
      .set('verif-hash', signature)
      .send(payload);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response2.body.message).toBe('Transaction already processed');
  });
});
```

### 2. Webhook Performance Tests

```javascript
// tests/webhooks/performance.test.js
describe('Webhook Performance', () => {
  test('should process webhook within acceptable time', async () => {
    const startTime = Date.now();
    
    const payload = {
      event: 'charge.completed',
      data: {
        tx_ref: 'perf-test-ref',
        amount: 1000,
        status: 'successful',
        meta: { user_id: 'test-user' }
      }
    };

    const signature = generateValidSignature(payload);

    const response = await request(app)
      .post('/webhook/flutterwave')
      .set('verif-hash', signature)
      .send(payload);

    const processingTime = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(processingTime).toBeLessThan(5000); // 5 seconds max
    expect(response.body).toHaveProperty('processingTimeMs');
  });
});
```

## Test Scenarios

### 1. Happy Path Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Successful Card Payment | 1. Initiate payment<br>2. Use valid test card<br>3. Complete payment | Wallet credited, transaction recorded |
| Successful Bank Transfer | 1. Initiate payment<br>2. Select bank transfer<br>3. Complete transfer | Wallet credited, notification sent |
| Multiple Payments | 1. Make payment 1<br>2. Make payment 2<br>3. Check balance | Balance = sum of payments |

### 2. Edge Cases

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Minimum Amount | 1. Enter ₦100<br>2. Initiate payment | Payment link created |
| Maximum Amount | 1. Enter ₦1,000,000<br>2. Initiate payment | Payment link created |
| Duplicate Webhook | 1. Send webhook<br>2. Send same webhook | Second webhook ignored |
| Network Timeout | 1. Initiate payment<br>2. Simulate timeout | Error handled gracefully |

### 3. Error Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Invalid Amount | 1. Enter ₦50<br>2. Initiate payment | Validation error |
| Failed Payment | 1. Use failed test card<br>2. Complete payment | Payment marked as failed |
| Invalid Webhook | 1. Send malformed webhook | Webhook rejected |
| Server Error | 1. Simulate server down<br>2. Make payment | Error message displayed |

## Performance Testing

### 1. Load Testing

```javascript
// tests/performance/load.test.js
const { performance } = require('perf_hooks');

describe('Payment System Load Tests', () => {
  test('should handle concurrent payment initiations', async () => {
    const concurrentRequests = 50;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app)
          .post('/api/v1/payment/initiate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 1000 })
      );
    }

    const startTime = performance.now();
    const responses = await Promise.all(promises);
    const endTime = performance.now();

    const successfulRequests = responses.filter(r => r.status === 200).length;
    const averageResponseTime = (endTime - startTime) / concurrentRequests;

    expect(successfulRequests).toBeGreaterThan(concurrentRequests * 0.95); // 95% success rate
    expect(averageResponseTime).toBeLessThan(1000); // Under 1 second average
  });

  test('should handle concurrent webhook processing', async () => {
    const concurrentWebhooks = 20;
    const promises = [];

    for (let i = 0; i < concurrentWebhooks; i++) {
      const payload = {
        event: 'charge.completed',
        data: {
          tx_ref: `load-test-${i}`,
          amount: 1000,
          status: 'successful',
          meta: { user_id: 'test-user' }
        }
      };

      promises.push(
        request(app)
          .post('/webhook/flutterwave')
          .set('verif-hash', generateValidSignature(payload))
          .send(payload)
      );
    }

    const responses = await Promise.all(promises);
    const successfulWebhooks = responses.filter(r => r.status === 200).length;

    expect(successfulWebhooks).toBe(concurrentWebhooks);
  });
});
```

### 2. Memory Usage Tests

```javascript
// tests/performance/memory.test.js
describe('Memory Usage Tests', () => {
  test('should not have memory leaks during payment processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process 100 payments
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post('/api/v1/payment/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 1000 });
    }

    // Force garbage collection
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
  });
});
```

## Security Testing

### 1. Authentication Tests

```javascript
// tests/security/auth.test.js
describe('Authentication Security', () => {
  test('should reject payment initiation without auth token', async () => {
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .send({ amount: 1000 });

    expect(response.status).toBe(401);
  });

  test('should reject payment initiation with invalid token', async () => {
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', 'Bearer invalid-token')
      .send({ amount: 1000 });

    expect(response.status).toBe(401);
  });
});
```

### 2. Input Validation Tests

```javascript
// tests/security/validation.test.js
describe('Input Validation Security', () => {
  test('should reject SQL injection attempts', async () => {
    const maliciousInput = "1000'; DROP TABLE payments; --";
    
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: maliciousInput });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('should reject XSS attempts', async () => {
    const maliciousInput = '<script>alert("xss")</script>';
    
    const response = await request(app)
      .post('/api/v1/payment/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ redirect_url: maliciousInput });

    expect(response.status).toBe(400);
  });
});
```

## Troubleshooting

### Common Test Issues

1. **Webhook signature verification fails:**
   ```bash
   # Check environment variable
   echo $FLW_WEBHOOK_HASH
   
   # Verify signature generation in test
   node -e "
   const crypto = require('crypto');
   const payload = {...};
   const hash = crypto.createHmac('sha256', process.env.FLW_WEBHOOK_HASH)
     .update(JSON.stringify(payload)).digest('hex');
   console.log(hash);
   "
   ```

2. **Database connection issues:**
   ```bash
   # Test Supabase connection
   node -e "
   const { supabase } = require('./config/supabase');
   supabase.from('users').select('count').then(console.log);
   "
   ```

3. **Test timeouts:**
   ```javascript
   // Increase timeout for integration tests
   jest.setTimeout(30000);
   ```

### Test Data Cleanup

```javascript
// tests/helpers/cleanup.js
const { supabase } = require('../../config/supabase');

async function cleanupTestData() {
  // Clean up test transactions
  await supabase
    .from('transactions')
    .delete()
    .like('payment_reference', 'test-%');

  // Clean up test payment logs
  await supabase
    .from('payment_logs')
    .delete()
    .like('tx_ref', 'test-%');

  // Clean up test webhooks
  await supabase
    .from('flutterwave_webhooks')
    .delete()
    .like('tx_ref', 'test-%');
}

module.exports = { cleanupTestData };
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/services/
npm test -- tests/controllers/
npm test -- tests/integration/

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run performance tests
npm run test:performance
```

## Test Reports

### Coverage Requirements

- **Statements:** > 90%
- **Branches:** > 85%
- **Functions:** > 90%
- **Lines:** > 90%

### Test Metrics

Monitor these metrics:

- **Test Execution Time:** < 2 minutes for full suite
- **Memory Usage:** < 100MB peak during tests
- **API Response Time:** < 500ms for 95th percentile
- **Webhook Processing Time:** < 1 second average

This comprehensive testing guide ensures the Flutterwave wallet funding system is robust, secure, and performant. Regular execution of these tests helps maintain system reliability and catch issues early in the development cycle.
