# Nellobytes Configuration Guide

This document explains how to configure and use the Nellobytesystems integration in your StarkTol VTU platform.

## Configuration Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# =================================
# NELLOBYTESYSTEMS VTU API CONFIG
# =================================

# API Base Configuration
NELLOBYTES_BASE_URL=https://api.nellobytesystems.com
NELLOBYTES_USERNAME=your_username_here
NELLOBYTES_PASSWORD=your_password_here
NELLOBYTES_API_KEY=your_api_key_here
NELLOBYTES_SECRET_KEY=your_secret_key_here

# Authentication & API Configuration
NELLOBYTES_AUTH_TYPE=bearer
NELLOBYTES_API_VERSION=v1
NELLOBYTES_TIMEOUT=30000
NELLOBYTES_RATE_LIMIT=60
NELLOBYTES_RETRY_ATTEMPTS=3
NELLOBYTES_RETRY_DELAY=5000

# Callback & Webhook Configuration
NELLOBYTES_CALLBACK_URL=https://yourdomain.com/api/v1/callback/nellobytes
NELLOBYTES_WEBHOOK_URL=https://yourdomain.com/api/v1/webhook/nellobytes
NELLOBYTES_WEBHOOK_SECRET=your_webhook_secret_here

# Service Endpoints (relative to base URL)
NELLOBYTES_NETWORKS_ENDPOINT=/networks
NELLOBYTES_DATA_PLANS_ENDPOINT=/data-plans
NELLOBYTES_AIRTIME_ENDPOINT=/airtime
NELLOBYTES_DATA_ENDPOINT=/data
NELLOBYTES_CABLE_ENDPOINT=/cable-tv
NELLOBYTES_ELECTRICITY_ENDPOINT=/electricity
NELLOBYTES_BALANCE_ENDPOINT=/balance
NELLOBYTES_STATUS_ENDPOINT=/transaction-status
```

### Required Variables

The following variables are **required** for the application to start:
- `NELLOBYTES_BASE_URL`
- `NELLOBYTES_USERNAME`
- `NELLOBYTES_PASSWORD`

### Optional Variables with Defaults

These variables are optional and have sensible defaults:
- `NELLOBYTES_AUTH_TYPE` (default: `bearer`)
- `NELLOBYTES_API_VERSION` (default: `v1`)
- `NELLOBYTES_TIMEOUT` (default: `30000` ms)
- `NELLOBYTES_RATE_LIMIT` (default: `60` requests/minute)
- `NELLOBYTES_RETRY_ATTEMPTS` (default: `3`)
- `NELLOBYTES_RETRY_DELAY` (default: `5000` ms)

## Using the Configuration Service

### Basic Usage

```javascript
const config = require('./config/environment');

// Access Nellobytes configuration
const nellobytesConfig = config.nellobytes;

console.log('Base URL:', nellobytesConfig.baseUrl);
console.log('Auth Type:', nellobytesConfig.authType);
console.log('Timeout:', nellobytesConfig.timeout);
```

### Getting Authentication Headers

```javascript
const config = require('./config/environment');

// Get properly formatted auth headers
const authHeaders = config.getNellobytesAuthHeaders();
console.log(authHeaders);
// Output (for bearer auth):
// {
//   'Authorization': 'Bearer your_api_key',
//   'Content-Type': 'application/json'
// }
```

### Getting Full Endpoint URLs

```javascript
const config = require('./config/environment');

// Get full endpoint URLs
const networksUrl = config.getNellobytesEndpoint('networks');
console.log(networksUrl);
// Output: https://api.nellobytesystems.com/v1/networks
```

### Using the Nellobytes Service

```javascript
const nellobytesService = require('./services/nellobytesService');

// Test connection
await nellobytesService.testConnection();

// Get networks
const networks = await nellobytesService.getNetworks();

// Purchase airtime
const airtimeResult = await nellobytesService.purchaseAirtime({
    network: 'MTN',
    phone: '08012345678',
    amount: 100
});

// Check balance
const balance = await nellobytesService.getBalance();
```

## Configuration Validation

The configuration service automatically validates:

### Auth Type Validation
- Must be one of: `bearer`, `basic`, `apikey`

### Timeout Validation
- Must be between 1000 and 60000 milliseconds

### Rate Limit Validation
- Must be between 1 and 1000 requests per minute

### Retry Configuration Validation
- `NELLOBYTES_RETRY_ATTEMPTS`: between 1 and 10
- `NELLOBYTES_RETRY_DELAY`: between 1000 and 30000 milliseconds

### URL Validation
- All URL fields must be valid URLs

## Authentication Types

### Bearer Token Authentication
```bash
NELLOBYTES_AUTH_TYPE=bearer
NELLOBYTES_API_KEY=your_bearer_token
```

### Basic Authentication
```bash
NELLOBYTES_AUTH_TYPE=basic
NELLOBYTES_USERNAME=your_username
NELLOBYTES_PASSWORD=your_password
```

### API Key Authentication
```bash
NELLOBYTES_AUTH_TYPE=apikey
NELLOBYTES_API_KEY=your_api_key
```

## Webhook Configuration

### Setting Up Webhooks

1. Configure your webhook URL:
```bash
NELLOBYTES_WEBHOOK_URL=https://yourdomain.com/api/v1/webhook/nellobytes
```

2. Set a webhook secret for signature verification:
```bash
NELLOBYTES_WEBHOOK_SECRET=your_secure_webhook_secret
```

### Verifying Webhook Signatures

```javascript
const nellobytesService = require('./services/nellobytesService');

// In your webhook handler
app.post('/api/v1/webhook/nellobytes', (req, res) => {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['x-signature']; // or whatever header Nellobytes uses
    
    const isValid = nellobytesService.verifyWebhookSignature(payload, signature);
    
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook...
    res.json({ success: true });
});
```

## Error Handling

The configuration service provides detailed error messages for invalid configurations:

```javascript
try {
    const config = require('./config/environment');
} catch (error) {
    console.error('Configuration error:', error.message);
    // Example: "Invalid NELLOBYTES_AUTH_TYPE: invalid. Must be one of: bearer, basic, apikey"
}
```

## Development vs Production

The configuration service automatically detects the environment and adjusts behavior:

- **Development**: Detailed error logging, auto-generated callback URLs
- **Production**: Minimal logging, explicit configuration required

## Configuration Summary

View the current configuration at startup:

```javascript
const config = require('./config/environment');
config.logConfigSummary();
```

This will output:
```
📋 Configuration Summary:
   Environment: development
   Server Port: 8000
   API Prefix: /api/v1
   Nellobytes Base URL: https://api.nellobytesystems.com
   Nellobytes Auth Type: bearer
   Nellobytes Rate Limit: 60/min
   Database: Supabase (Configured)
```

## Troubleshooting

### Common Issues

1. **Missing required configuration**
   - Error: "Missing required configuration: nellobytes.username, nellobytes.password"
   - Solution: Ensure all required environment variables are set in your `.env` file

2. **Invalid auth type**
   - Error: "Invalid NELLOBYTES_AUTH_TYPE: custom. Must be one of: bearer, basic, apikey"
   - Solution: Use one of the supported authentication types

3. **Invalid URL format**
   - Error: "NELLOBYTES_BASE_URL must be a valid URL"
   - Solution: Ensure URLs start with `http://` or `https://`

4. **Configuration loading issues**
   - Ensure your `.env` file is in the root directory
   - Check for syntax errors in environment variable names
   - Verify there are no extra spaces around the `=` sign

### Testing Configuration

Use the built-in test methods:

```javascript
const nellobytesService = require('./services/nellobytesService');

// Test API connection
const isConnected = await nellobytesService.testConnection();

// Get configuration summary
const summary = nellobytesService.getConfigSummary();
console.log(summary);
```
