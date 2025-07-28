# 🛡️ Security Implementation Guide

This document outlines the comprehensive security measures implemented in the StarkTol VTU Backend API.

## 🔒 Security Features

### 1. Environment Variable Management
- **No hardcoded secrets**: All sensitive data is stored in environment variables
- **Secure defaults**: Production-ready configuration with secure fallbacks
- **Validation**: Environment variables are validated on startup
- **Template provided**: Complete `.env.example` with all required variables

### 2. Input Sanitization & Validation
- **XSS Protection**: Removes all HTML tags and malicious scripts
- **SQL/NoSQL Injection Prevention**: Sanitizes database query inputs
- **Data Type Validation**: Ensures correct data types for all inputs
- **Schema-based Validation**: Uses Joi schemas for comprehensive validation
- **Request Size Limiting**: Prevents large payload attacks

### 3. Security Headers & Middleware
- **Helmet.js**: Comprehensive security headers
- **CORS Protection**: Configurable cross-origin resource sharing
- **Rate Limiting**: Multiple rate limiters for different endpoints
- **Parameter Pollution Prevention**: Protects against HPP attacks
- **Content-Type Validation**: Ensures proper request formats

### 4. Authentication & Authorization
- **JWT Security**: Secure token implementation with Supabase
- **Password Hashing**: bcrypt with configurable salt rounds
- **Session Management**: Secure session handling
- **Role-based Access**: Middleware for permission checking

### 5. Monitoring & Logging
- **Security Event Logging**: Tracks suspicious activities
- **Request Monitoring**: Logs potentially malicious requests
- **Error Handling**: Secure error responses without data leakage

## 📁 Security File Structure

```
├── utils/
│   ├── inputSanitizer.js      # Input sanitization utilities
│   ├── security.js            # Encryption and hashing utilities
│   └── validator.js           # Joi validation schemas
├── middlewares/
│   ├── securityMiddleware.js  # Comprehensive security middleware
│   ├── validateRequest.js     # Request validation middleware
│   └── authMiddleware.js      # Authentication middleware
├── config/
│   └── environment.js         # Environment configuration
├── scripts/
│   └── verify-security.js     # Security verification script
└── .env.example              # Environment variable template
```

## 🚀 Quick Setup

### 1. Environment Setup
```bash
# Copy the environment template
cp .env.example .env

# Generate secure random keys
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Add the generated keys to your .env file
```

### 2. Security Dependencies
All required security dependencies are automatically installed:
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `express-mongo-sanitize` - NoSQL injection prevention
- `hpp` - HTTP Parameter Pollution prevention
- `xss` - XSS protection
- `validator` - Input validation
- `bcryptjs` - Password hashing

### 3. Verification
Run the security verification script to ensure everything is properly configured:
```bash
node scripts/verify-security.js
```

## 🛡️ Security Middleware Usage

### Basic Security Stack
```javascript
const { createSecurityStack } = require('./middlewares/securityMiddleware');

// Apply comprehensive security to all routes
app.use('/api', createSecurityStack());
```

### Custom Security Configuration
```javascript
const { createSecurityStack } = require('./middlewares/securityMiddleware');

// Custom security for authentication routes
app.use('/api/auth', createSecurityStack({
    rateLimitType: 'auth',
    enableInputSanitization: true,
    sanitizationSchema: {
        email: { type: 'email' },
        password: { type: 'string', options: { min: 8 } }
    }
}));
```

### Input Sanitization
```javascript
const { sanitizeInput } = require('./utils/inputSanitizer');

// Sanitize individual inputs
const cleanEmail = sanitizeInput(userInput.email, { type: 'email' });
const cleanAmount = sanitizeInput(userInput.amount, { type: 'number', min: 0 });

// Sanitize entire objects
const cleanUserData = sanitizeInput(req.body, {
    type: 'object',
    schema: {
        name: { type: 'string' },
        email: { type: 'email' },
        phone: { type: 'phone' }
    }
});
```

## 🔐 Environment Variables

### Critical Security Variables
```bash
# Encryption & Sessions (REQUIRED - min 32 chars)
ENCRYPTION_KEY=your_32_char_encryption_key_here
SESSION_SECRET=your_32_char_session_secret_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Request Limits
MAX_REQUEST_SIZE=10mb
MAX_FIELDS=1000
MAX_FILES=10
MAX_FILE_SIZE=5mb

# Security Features
ENABLE_HELMET=true
ENABLE_CORS=true
ENABLE_COMPRESSION=true
```

### Database & Authentication
```bash
# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Webhooks
WEBHOOK_SECRET=your_webhook_secret
API_KEY_SECRET=your_api_key_secret
```

## ⚠️ Security Best Practices

### Development
1. **Never commit .env files** - Always in .gitignore
2. **Use strong, unique keys** - Generate with crypto.randomBytes()
3. **Test security measures** - Run verification script regularly
4. **Monitor logs** - Watch for suspicious activities
5. **Keep dependencies updated** - Regular security updates

### Production
1. **Environment variables** - Set all variables in deployment platform
2. **HTTPS only** - Never use HTTP in production
3. **Regular audits** - Run `npm audit` regularly
4. **Monitoring** - Implement proper logging and alerting
5. **Backup strategies** - Secure data backup procedures

## 🔍 Security Monitoring

### Logging Patterns
The system automatically logs:
- Failed authentication attempts
- Rate limit violations
- Suspicious input patterns
- SQL/NoSQL injection attempts
- XSS attack attempts
- Parameter pollution attempts

### Log Format
```javascript
{
  timestamp: "2024-01-15T10:30:00Z",
  level: "warn",
  event: "suspicious_request",
  ip: "192.168.1.100",
  userAgent: "...",
  url: "/api/auth/login",
  method: "POST",
  pattern: "sql_injection_attempt"
}
```

## 🚨 Incident Response

### If You Suspect a Security Breach:
1. **Immediate Actions**:
   - Change all API keys and secrets
   - Review recent logs for suspicious activity
   - Check database for unauthorized changes
   - Notify all team members

2. **Investigation**:
   - Analyze access logs
   - Check for data exfiltration
   - Review user account activities
   - Document all findings

3. **Recovery**:
   - Apply security patches
   - Reset affected user passwords
   - Update security configurations
   - Implement additional monitoring

## 📞 Security Contacts

For security-related issues:
- **Email**: security@yourdomain.com
- **Emergency**: Use your incident response procedures
- **Updates**: Monitor security advisories for dependencies

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Supabase Security Documentation](https://supabase.com/docs/guides/auth/security)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security measures as the application evolves.
