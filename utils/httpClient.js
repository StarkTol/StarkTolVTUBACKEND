/**
 * Enhanced HTTP Client with Axios
 * Features: Automatic JSON parsing, timeout, retries, logging
 * Standardized error handling for VTU platform
 */
const axios = require('axios');
const axiosRetry = require('axios-retry');
const winston = require('winston');
const ProviderError = require('./ProviderError');

// Configure winston logger with better formatting
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'http-client' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        }),
    ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

/**
 * Create HTTP client with provider-specific configuration
 * @param {Object} config - Configuration options
 * @param {string} config.baseURL - Base URL for the API
 * @param {number} config.timeout - Request timeout in milliseconds
 * @param {Object} config.headers - Default headers
 * @param {string} config.provider - Provider name for logging
 * @param {number} config.retries - Number of retry attempts
 * @param {boolean} config.enableLogging - Enable request/response logging
 * @returns {Object} Configured axios instance
 */
function createHttpClient(config = {}) {
    const {
        baseURL,
        timeout = 30000, // 30 seconds default
        headers = { 'Content-Type': 'application/json' },
        provider = 'unknown',
        retries = 3,
        enableLogging = true,
        retryCondition = null
    } = config;

    // Create axios instance
    const client = axios.create({
        baseURL,
        timeout,
        headers,
        // Automatically parse JSON responses
        responseType: 'json',
        // Don't throw for HTTP error status codes
        validateStatus: () => true
    });

    // Configure retry mechanism
    axiosRetry(client, {
        retries,
        retryDelay: (retryCount, error) => {
            // Exponential backoff with jitter
            const delay = Math.pow(2, retryCount) * 1000;
            const jitter = Math.random() * 1000;
            return delay + jitter;
        },
        retryCondition: retryCondition || ((error) => {
            // Retry on network errors, timeouts, and 5xx server errors
            return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                   (error.response && error.response.status >= 500);
        })
    });

    // Request interceptor for logging and preprocessing
    client.interceptors.request.use(
        (request) => {
            if (enableLogging) {
                logger.info('HTTP Request', {
                    provider,
                    method: request.method?.toUpperCase(),
                    url: request.url,
                    baseURL: request.baseURL,
                    timeout: request.timeout,
                    headers: sanitizeHeaders(request.headers),
                    data: sanitizeRequestData(request.data)
                });
            }
            
            // Add request timestamp
            request.metadata = { startTime: Date.now() };
            return request;
        },
        (error) => {
            logger.error('Request Setup Error', {
                provider,
                error: error.message,
                stack: error.stack
            });
            return Promise.reject(error);
        }
    );

    // Response interceptor for logging and error standardization
    client.interceptors.response.use(
        (response) => {
            const duration = Date.now() - response.config.metadata?.startTime;
            
            if (enableLogging) {
                logger.info('HTTP Response', {
                    provider,
                    method: response.config.method?.toUpperCase(),
                    url: response.config.url,
                    status: response.status,
                    statusText: response.statusText,
                    duration,
                    headers: sanitizeHeaders(response.headers),
                    data: sanitizeResponseData(response.data)
                });
            }

            // Handle HTTP error status codes
            if (response.status >= 400) {
                const error = createStandardError(response, provider);
                return Promise.reject(error);
            }

            return response;
        },
        (error) => {
            const duration = error.config?.metadata ? 
                Date.now() - error.config.metadata.startTime : 0;

            logger.error('HTTP Error', {
                provider,
                method: error.config?.method?.toUpperCase(),
                url: error.config?.url,
                duration,
                error: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                response: sanitizeResponseData(error.response?.data)
            });

            // Create standardized error
            const standardError = createStandardError(error.response || error, provider, error);
            return Promise.reject(standardError);
        }
    );

    return client;
}

/**
 * Create standardized error object
 * @param {Object} response - HTTP response or error object
 * @param {string} provider - Provider name
 * @param {Object} originalError - Original error object
 * @returns {Object} Standardized error object
 */
function createStandardError(response, provider, originalError = null) {
    if (originalError && originalError.code === 'ECONNABORTED') {
        return {
            code: 'TIMEOUT_ERROR',
            message: `Request to ${provider} timed out`,
            provider,
            raw: originalError
        };
    }

    if (originalError && !response) {
        return {
            code: 'NETWORK_ERROR',
            message: `Network error communicating with ${provider}: ${originalError.message}`,
            provider,
            raw: originalError
        };
    }

    const status = response?.status || 500;
    const data = response?.data || {};
    
    return {
        code: data.code || data.error_code || `HTTP_${status}`,
        message: data.message || data.error || response?.statusText || 'Unknown error',
        provider,
        raw: {
            status,
            statusText: response?.statusText,
            data,
            headers: response?.headers
        }
    };
}

/**
 * Sanitize headers for logging (remove sensitive data)
 * @param {Object} headers - Headers object
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    const sensitiveHeaders = [
        'authorization', 'x-api-key', 'x-auth-token', 
        'cookie', 'set-cookie', 'x-secret-key'
    ];
    
    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
        if (sanitized[header.toLowerCase()]) {
            sanitized[header.toLowerCase()] = '[REDACTED]';
        }
    });
    
    return sanitized;
}

/**
 * Sanitize request data for logging
 * @param {*} data - Request data
 * @returns {*} Sanitized data
 */
function sanitizeRequestData(data) {
    if (!data) return data;
    
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return '[NON_JSON_DATA]';
        }
    }
    
    if (typeof data === 'object') {
        const sanitized = { ...data };
        const sensitiveFields = [
            'password', 'pin', 'secret', 'key', 'token', 
            'credit_card', 'cvv', 'ssn', 'bvn'
        ];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
    
    return data;
}

/**
 * Sanitize response data for logging
 * @param {*} data - Response data
 * @returns {*} Sanitized data
 */
function sanitizeResponseData(data) {
    if (!data || typeof data !== 'object') return data;
    
    // Limit response data size for logging
    const dataString = JSON.stringify(data);
    if (dataString.length > 5000) {
        return '[LARGE_RESPONSE_DATA_TRUNCATED]';
    }
    
    return data;
}

// Default HTTP client instance
const defaultHttpClient = createHttpClient({
    timeout: 30000,
    provider: 'default',
    retries: 3
});

module.exports = {
    createHttpClient,
    httpClient: defaultHttpClient,
    logger
};
