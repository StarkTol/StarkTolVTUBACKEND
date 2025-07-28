/**
 * Comprehensive Security Middleware
 * Integrates input sanitization, validation, and security headers
 */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { inputSanitizer } = require('../utils/inputSanitizer');
const { generateResponse } = require('../utils/helpers');

/**
 * Security Middleware Class
 */
class SecurityMiddleware {
    constructor() {
        this.rateLimiters = new Map();
    }

    /**
     * Apply security headers using Helmet
     * @returns {function} Express middleware
     */
    applySecurityHeaders() {
        const config = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    scriptSrc: ["'self'"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.flutterwave.com", "wss:"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: { policy: "cross-origin" },
            crossOriginResourcePolicy: { policy: "cross-origin" },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: "no-referrer" },
            xssFilter: true
        };

        // Disable CSP in development for easier debugging
        if (process.env.NODE_ENV === 'development') {
            config.contentSecurityPolicy = false;
        }

        return helmet(config);
    }

    /**
     * Create rate limiting middleware
     * @param {object} options - Rate limiting options
     * @returns {function} Express middleware
     */
    createRateLimit(options = {}) {
        const {
            windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
            max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            message = 'Too many requests from this IP, please try again later.',
            standardHeaders = true,
            legacyHeaders = false,
            keyGenerator = (req) => req.ip,
            skipSuccessfulRequests = false,
            skipFailedRequests = false,
            ...otherOptions
        } = options;

        return rateLimit({
            windowMs,
            max,
            message: {
                success: false,
                message,
                error: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders,
            legacyHeaders,
            keyGenerator,
            skipSuccessfulRequests,
            skipFailedRequests,
            ...otherOptions
        });
    }

    /**
     * Create different rate limiters for different endpoints
     */
    createRateLimiters() {
        // General API rate limiter
        this.rateLimiters.set('api', this.createRateLimit());

        // Strict rate limiter for authentication endpoints
        this.rateLimiters.set('auth', this.createRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 10, // Only 10 attempts per 15 minutes
            message: 'Too many authentication attempts, please try again later.'
        }));

        // Payment endpoints rate limiter
        this.rateLimiters.set('payment', this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 5, // Only 5 payment requests per minute
            message: 'Too many payment requests, please try again later.'
        }));

        // VTU purchase rate limiter
        this.rateLimiters.set('vtu', this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 10, // 10 VTU purchases per minute
            message: 'Too many VTU requests, please try again later.'
        }));

        // Support ticket rate limiter
        this.rateLimiters.set('support', this.createRateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // 5 support tickets per hour
            message: 'Too many support tickets created, please try again later.'
        }));
    }

    /**
     * Get rate limiter by name
     * @param {string} name - Rate limiter name
     * @returns {function} Rate limiter middleware
     */
    getRateLimit(name = 'api') {
        if (!this.rateLimiters.has(name)) {
            this.createRateLimiters();
        }
        return this.rateLimiters.get(name) || this.rateLimiters.get('api');
    }

    /**
     * Prevent HTTP Parameter Pollution
     * @returns {function} Express middleware
     */
    preventParameterPollution() {
        return hpp({
            whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'status', 'type']
        });
    }

    /**
     * Sanitize NoSQL injection attempts
     * @returns {function} Express middleware
     */
    preventNoSQLInjection() {
        return mongoSanitize({
            replaceWith: '_',
            onSanitize: ({ req, key }) => {
                console.warn(`🚨 NoSQL injection attempt detected from ${req.ip} on key: ${key}`);
            }
        });
    }

    /**
     * Input sanitization middleware
     * @param {object} schema - Sanitization schema
     * @returns {function} Express middleware
     */
    sanitizeInputs(schema = {}) {
        return inputSanitizer.createSanitizationMiddleware(schema);
    }

    /**
     * Request size limiting middleware
     * @returns {function} Express middleware
     */
    limitRequestSize() {
        return (req, res, next) => {
            const maxSize = process.env.MAX_REQUEST_SIZE || '10mb';
            const contentLength = req.headers['content-length'];
            
            if (contentLength) {
                const sizeInMB = parseInt(contentLength) / (1024 * 1024);
                const maxSizeInMB = parseInt(maxSize.replace('mb', ''));
                
                if (sizeInMB > maxSizeInMB) {
                    return res.status(413).json({
                        success: false,
                        message: `Request size too large. Maximum allowed: ${maxSize}`,
                        error: 'REQUEST_TOO_LARGE'
                    });
                }
            }
            
            next();
        };
    }

    /**
     * Validate Content-Type header
     * @param {array} allowedTypes - Allowed content types
     * @returns {function} Express middleware
     */
    validateContentType(allowedTypes = ['application/json']) {
        return (req, res, next) => {
            if (req.method === 'GET' || req.method === 'DELETE') {
                return next();
            }

            const contentType = req.headers['content-type'];
            if (!contentType) {
                return res.status(400).json({
                    success: false,
                    message: 'Content-Type header is required',
                    error: 'MISSING_CONTENT_TYPE'
                });
            }

            const isValidType = allowedTypes.some(type => 
                contentType.toLowerCase().startsWith(type.toLowerCase())
            );

            if (!isValidType) {
                return res.status(415).json({
                    success: false,
                    message: `Unsupported Content-Type. Allowed types: ${allowedTypes.join(', ')}`,
                    error: 'UNSUPPORTED_CONTENT_TYPE'
                });
            }

            next();
        };
    }

    /**
     * Log security events
     * @returns {function} Express middleware
     */
    logSecurityEvents() {
        return (req, res, next) => {
            // Log suspicious patterns
            const suspiciousPatterns = [
                /(<script|javascript:|vbscript:|onload=|onerror=)/i,
                /(union\s+select|drop\s+table|insert\s+into)/i,
                /(\$where|\$ne|\$in|\$regex)/i,
                /(\.\.\/|\.\.\\|\/etc\/|\/proc\/)/i
            ];

            const requestBody = JSON.stringify(req.body || {});
            const queryString = JSON.stringify(req.query || {});
            const checkString = `${requestBody} ${queryString} ${req.url}`;

            const isSuspicious = suspiciousPatterns.some(pattern => 
                pattern.test(checkString)
            );

            if (isSuspicious) {
                console.warn('🚨 Suspicious request detected:', {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    url: req.url,
                    method: req.method,
                    body: req.body,
                    query: req.query,
                    timestamp: new Date().toISOString()
                });
            }

            next();
        };
    }

    /**
     * Comprehensive security middleware stack
     * @param {object} options - Configuration options
     * @returns {array} Array of middleware functions
     */
    createSecurityStack(options = {}) {
        const {
            enableHelmet = process.env.ENABLE_HELMET !== 'false',
            enableRateLimit = true,
            rateLimitType = 'api',
            enableInputSanitization = true,
            sanitizationSchema = {},
            enableParameterPollution = true,
            enableNoSQLProtection = true,
            enableRequestSizeLimit = true,
            enableContentTypeValidation = true,
            allowedContentTypes = ['application/json'],
            enableSecurityLogging = true
        } = options;

        const middlewares = [];

        // Initialize rate limiters if needed
        if (enableRateLimit && !this.rateLimiters.has(rateLimitType)) {
            this.createRateLimiters();
        }

        // Security headers
        if (enableHelmet) {
            middlewares.push(this.applySecurityHeaders());
        }

        // Rate limiting
        if (enableRateLimit) {
            middlewares.push(this.getRateLimit(rateLimitType));
        }

        // Security logging
        if (enableSecurityLogging) {
            middlewares.push(this.logSecurityEvents());
        }

        // Request size limiting
        if (enableRequestSizeLimit) {
            middlewares.push(this.limitRequestSize());
        }

        // Content-Type validation
        if (enableContentTypeValidation) {
            middlewares.push(this.validateContentType(allowedContentTypes));
        }

        // Parameter pollution prevention
        if (enableParameterPollution) {
            middlewares.push(this.preventParameterPollution());
        }

        // NoSQL injection prevention
        if (enableNoSQLProtection) {
            middlewares.push(this.preventNoSQLInjection());
        }

        // Input sanitization
        if (enableInputSanitization) {
            middlewares.push(this.sanitizeInputs(sanitizationSchema));
        }

        return middlewares;
    }
}

// Create singleton instance
const securityMiddleware = new SecurityMiddleware();

module.exports = {
    SecurityMiddleware,
    securityMiddleware,
    
    // Direct access to middleware methods
    applySecurityHeaders: () => securityMiddleware.applySecurityHeaders(),
    createRateLimit: (options) => securityMiddleware.createRateLimit(options),
    getRateLimit: (name) => securityMiddleware.getRateLimit(name),
    preventParameterPollution: () => securityMiddleware.preventParameterPollution(),
    preventNoSQLInjection: () => securityMiddleware.preventNoSQLInjection(),
    sanitizeInputs: (schema) => securityMiddleware.sanitizeInputs(schema),
    limitRequestSize: () => securityMiddleware.limitRequestSize(),
    validateContentType: (types) => securityMiddleware.validateContentType(types),
    logSecurityEvents: () => securityMiddleware.logSecurityEvents(),
    createSecurityStack: (options) => securityMiddleware.createSecurityStack(options)
};
