# Nellobytes HTTP Helper

A comprehensive, reusable HTTP helper specifically designed for making GET requests to the Nellobytesystems API with advanced features including retry logic, query string building, automatic authentication, and response parsing.

## Features

### 🚀 Core Features
- **Timeout Management**: Configurable request timeouts with sensible defaults
- **Retry Logic**: Exponential backoff with jitter for failed requests
- **Query String Builder**: Advanced parameter handling including arrays and nested objects
- **Automatic Authentication**: Supports multiple auth types (Bearer, Basic, API Key)
- **Request Signing**: HMAC-SHA256 request signing for enhanced security
- **Response Parsing**: Automatic parsing of JSON, CSV, plain text, and XML responses
- **Error Mapping**: Comprehensive error classification and mapping
- **Logging**: Detailed request/response logging for development

### 🛡️ Security Features
- Request signing with HMAC-SHA256
- Automatic credential attachment
- Secure header management
- Error sanitization

### 📊 Response Handling
- JSON response parsing
- CSV data parsing with header extraction
- Plain text response handling
- XML response support
- Content-type based auto-detection

## Installation

The helper is already included in the project. Simply require it:

```javascript
const nellobytesHttpHelper = require('./utils/nellobytesHttpHelper');
```

## Configuration

The helper uses the existing environment configuration from `config/environment.js`. Ensure these environment variables are set:

```env
# Required
NELLOBYTES_BASE_URL=https://api.nellobytesystems.com
NELLOBYTES_USERNAME=your_username
NELLOBYTES_PASSWORD=your_password

# Optional but recommended
NELLOBYTES_API_KEY=your_api_key
NELLOBYTES_SECRET_KEY=your_secret_key
NELLOBYTES_AUTH_TYPE=bearer|basic|apikey
NELLOBYTES_TIMEOUT=30000
NELLOBYTES_RETRY_ATTEMPTS=3
NELLOBYTES_RETRY_DELAY=5000
```

## Basic Usage

### Simple GET Request

```javascript
const result = await nellobytesHttpHelper.get('networks');

if (result.success) {
    console.log('Data:', result.data);
    console.log('Response type:', result.type);
} else {
    console.error('Error:', result.error.message);
}
```

### GET Request with Parameters

```javascript
const result = await nellobytesHttpHelper.get('data-plans', {
    network: 'mtn',
    type: 'prepaid',
    active: true
});
```

### Using Convenience Methods

```javascript
// Get networks
const networks = await nellobytesHttpHelper.getNetworks();

// Get data plans for MTN
const dataPlans = await nellobytesHttpHelper.getDataPlans('mtn');

// Check account balance
const balance = await nellobytesHttpHelper.getBalance();

// Check transaction status
const status = await nellobytesHttpHelper.getTransactionStatus('TXN123456');
```

## Advanced Usage

### Complex Query Parameters

The helper supports complex parameter structures:

```javascript
const params = {
    network: 'mtn',
    amounts: [100, 200, 500], // Arrays
    filters: {                 // Nested objects
        status: 'active',
        region: 'lagos'
    },
    sort: 'price',
    limit: 50
};

const result = await nellobytesHttpHelper.get('data-plans', params);
// Generated URL: /data-plans?network=mtn&amounts=100&amounts=200&amounts=500&filters.status=active&filters.region=lagos&sort=price&limit=50
```

### Custom Request Options

```javascript
const result = await nellobytesHttpHelper.get('networks', {}, {
    timeout: 10000,           // Custom timeout
    headers: {               // Additional headers
        'X-Custom-Header': 'value'
    }
});
```

### Query String Builder

Use the query string builder independently:

```javascript
const params = {
    network: 'mtn',
    active: true,
    filters: { type: 'data' }
};

const queryString = nellobytesHttpHelper.buildQueryString(params);
console.log(queryString); // "network=mtn&active=true&filters.type=data"
```

## Response Format

All requests return a standardized response object:

### Successful Response

```javascript
{
    success: true,
    status: 200,
    statusText: 'OK',
    headers: { ... },
    type: 'json',                    // 'json', 'csv', 'text', 'xml', 'unknown'
    data: { ... },                   // Parsed response data
    raw: '...',                      // Raw response string
    meta: {
        attempt: 1,
        endpoint: '/networks',
        timestamp: '2024-01-01T12:00:00.000Z'
    }
}
```

### Failed Response

```javascript
{
    success: false,
    error: {
        name: 'NellobytesHttpError',
        message: 'Request failed',
        status: 404,
        code: 'NOT_FOUND',
        type: 'CLIENT_ERROR',
        retryable: false,
        timestamp: '2024-01-01T12:00:00.000Z',
        details: 'The requested resource was not found',
        responseData: { ... }        // Original error response if available
    },
    meta: {
        attempts: 3,
        endpoint: '/invalid',
        timestamp: '2024-01-01T12:00:00.000Z'
    }
}
```

## Response Types

### JSON Response
```javascript
{
    type: 'json',
    data: { networks: [...] },
    raw: '{"networks":[...]}'
}
```

### CSV Response
```javascript
{
    type: 'csv',
    data: {
        headers: ['id', 'network', 'price'],
        rows: [
            { id: '1', network: 'mtn', price: '100' },
            { id: '2', network: 'airtel', price: '95' }
        ],
        count: 2
    },
    raw: 'id,network,price\n1,mtn,100\n2,airtel,95'
}
```

### Plain Text Response
```javascript
{
    type: 'text',
    data: 'Success: Transaction completed',
    raw: 'Success: Transaction completed\n'
}
```

## Error Handling

### Error Types
- **NETWORK_ERROR**: Connection issues
- **TIMEOUT_ERROR**: Request timeout
- **CLIENT_ERROR**: 4xx HTTP status codes
- **SERVER_ERROR**: 5xx HTTP status codes
- **UNKNOWN_ERROR**: Other errors

### Error Codes
- **BAD_REQUEST**: Invalid request parameters
- **UNAUTHORIZED**: Authentication failure
- **FORBIDDEN**: Permission denied
- **NOT_FOUND**: Resource not found
- **RATE_LIMITED**: Too many requests
- **INTERNAL_ERROR**: Server error
- **SERVICE_UNAVAILABLE**: Service down

### Retryable Errors

The helper automatically retries these error conditions:
- Network timeouts and connection resets
- HTTP 408, 429, 500, 502, 503, 504 status codes
- DNS resolution failures

### Custom Error Handling

```javascript
const result = await nellobytesHttpHelper.get('networks');

if (!result.success) {
    const { error } = result;
    
    switch (error.type) {
        case 'NETWORK_ERROR':
            console.log('Network issue, try again later');
            break;
        case 'CLIENT_ERROR':
            console.log('Check your request parameters');
            break;
        case 'SERVER_ERROR':
            console.log('API server issue');
            break;
        default:
            console.log('Unknown error occurred');
    }
    
    if (error.retryable) {
        console.log('This error can be retried');
    }
}
```

## Utility Methods

### Test Connection
```javascript
const connectionResult = await nellobytesHttpHelper.testConnection();
console.log('Connected:', connectionResult.success);
```

### Get Configuration Summary
```javascript
const config = nellobytesHttpHelper.getConfigSummary();
console.log('Timeout:', config.timeout);
console.log('Retry attempts:', config.retryAttempts);
console.log('Base URL:', config.baseURL);
```

## Integration with Services

### Service Layer Integration

```javascript
class VTUService {
    async getNetworks() {
        const result = await nellobytesHttpHelper.getNetworks();
        
        if (result.success) {
            return {
                success: true,
                networks: result.data
            };
        }
        
        throw new Error(`Failed to get networks: ${result.error.message}`);
    }
    
    async purchaseData(phone, network, planId) {
        // Validate plan availability
        const plansResult = await nellobytesHttpHelper.getDataPlans(network);
        if (!plansResult.success) {
            throw new Error('Unable to validate plan');
        }
        
        // Check balance
        const balanceResult = await nellobytesHttpHelper.getBalance();
        if (!balanceResult.success) {
            throw new Error('Unable to check balance');
        }
        
        // Proceed with purchase logic...
        return { success: true, transactionId: 'TXN123' };
    }
}
```

### Controller Integration

```javascript
// In your controller
const vtuController = {
    async getNetworks(req, res) {
        try {
            const result = await nellobytesHttpHelper.getNetworks();
            
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data,
                    meta: result.meta
                });
            } else {
                res.status(result.error.status || 500).json({
                    success: false,
                    error: {
                        message: result.error.message,
                        code: result.error.code
                    }
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: { message: 'Internal server error' }
            });
        }
    }
};
```

## Testing

Run the test file to verify functionality:

```bash
node test-nellobytes-http.js
```

Run usage examples:

```bash
node examples/nellobytesHttpHelperUsage.js
```

## Best Practices

1. **Always check the `success` property** before accessing response data
2. **Handle errors gracefully** and provide meaningful feedback
3. **Use convenience methods** when available for better code readability
4. **Configure appropriate timeouts** for your use case
5. **Monitor retry attempts** to detect API issues
6. **Log important operations** for debugging and monitoring
7. **Validate input parameters** before making requests
8. **Cache frequently accessed data** (like networks list) when appropriate

## Performance Considerations

- The helper implements connection pooling through Axios
- Request/response interceptors add minimal overhead
- Retry logic includes exponential backoff to prevent API overload
- Query string building is optimized for complex parameters
- Response parsing is efficient and memory-conscious

## Troubleshooting

### Common Issues

1. **Authentication failures**: Check `NELLOBYTES_USERNAME`, `NELLOBYTES_PASSWORD`, and auth type
2. **Timeout errors**: Increase `NELLOBYTES_TIMEOUT` value
3. **Rate limiting**: Requests are being throttled by API
4. **Network errors**: Check connectivity and firewall settings

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging:

```bash
NODE_ENV=development node your-app.js
```

This will log:
- Request URLs and parameters
- Response status codes
- Error details
- Retry attempts

### Configuration Validation

The helper validates configuration on startup and will throw errors for:
- Missing required credentials
- Invalid timeout values
- Invalid retry settings
- Malformed URLs

## Migration from Old Service

If migrating from the existing `nellobytesService.js`:

### Before
```javascript
const nellobytesService = require('./services/nellobytesService');
const result = await nellobytesService.getNetworks();
```

### After
```javascript
const nellobytesHttpHelper = require('./utils/nellobytesHttpHelper');
const result = await nellobytesHttpHelper.getNetworks();
```

The response format is enhanced but backward compatible. Update your error handling to use the new error structure for better debugging.

## Support

For issues or questions regarding the Nellobytes HTTP Helper:

1. Check the test files for usage examples
2. Review the error messages for specific guidance
3. Enable debug logging for detailed request/response information
4. Verify environment configuration matches requirements
