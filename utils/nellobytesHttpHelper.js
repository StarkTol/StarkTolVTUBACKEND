const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/environment');

/**
 * Reusable HTTP Helper for Nellobytesystems API
 * Features:
 * - Timeout and retry logic with exponential backoff
 * - Query string builder
 * - Automatic authentication (username/password, API key, signing)
 * - Centralized response parsing (JSON, plain text, CSV-like)
 * - Comprehensive error mapping and handling
 */
class NellobytesHttpHelper {
    constructor() {
        this.config = config.nellobytes;
        this.baseURL = this.config.baseUrl;
        this.timeout = this.config.timeout;
        this.retryAttempts = this.config.retryAttempts;
        this.retryDelay = this.config.retryDelay;
        
        // Initialize axios instance
        this.client = this._createAxiosInstance();
        
        // Setup interceptors
        this._setupInterceptors();
    }

    /**
     * Create configured Axios instance
     */
    _createAxiosInstance() {
        return axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'User-Agent': 'StarkTol-VTU-Platform/1.0',
                'Accept': 'application/json, text/plain, text/csv',
                ...this._getAuthHeaders()
            }
        });
    }

    /**
     * Setup request and response interceptors
     */
    _setupInterceptors() {
        // Request interceptor for logging and signing
        this.client.interceptors.request.use(
            (requestConfig) => {
                // Add timestamp for request signing
                requestConfig.headers['X-Timestamp'] = Date.now().toString();
                
                // Sign request if secret key is available
                if (this.config.secretKey) {
                    requestConfig.headers['X-Signature'] = this._signRequest(requestConfig);
                }

                if (config.isDevelopment) {
                    console.log(`[NellobytesHTTP] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
                    console.log(`[NellobytesHTTP] Headers:`, requestConfig.headers);
                    if (requestConfig.params) {
                        console.log(`[NellobytesHTTP] Query Params:`, requestConfig.params);
                    }
                }
                
                return requestConfig;
            },
            (error) => {
                console.error('[NellobytesHTTP] Request interceptor error:', error.message);
                return Promise.reject(this._mapError(error));
            }
        );

        // Response interceptor for logging and error handling
        this.client.interceptors.response.use(
            (response) => {
                if (config.isDevelopment) {
                    console.log(`[NellobytesHTTP] Response ${response.status} for ${response.config.url}`);
                }
                return response;
            },
            (error) => {
                console.error('[NellobytesHTTP] Response error:', {
                    status: error.response?.status,
                    message: error.message,
                    url: error.config?.url
                });
                return Promise.reject(this._mapError(error));
            }
        );
    }

    /**
     * Get authentication headers based on configuration
     */
    _getAuthHeaders() {
        return config.getNellobytesAuthHeaders();
    }

    /**
     * Sign request for enhanced security
     */
    _signRequest(requestConfig) {
        const timestamp = requestConfig.headers['X-Timestamp'];
        const method = requestConfig.method?.toUpperCase() || 'GET';
        const url = requestConfig.url || '';
        const data = requestConfig.data ? JSON.stringify(requestConfig.data) : '';
        
        // Create signature string
        const signatureString = `${method}|${url}|${timestamp}|${data}`;
        
        // Generate HMAC-SHA256 signature
        return crypto
            .createHmac('sha256', this.config.secretKey)
            .update(signatureString)
            .digest('hex');
    }

    /**
     * Build query string from parameters object
     */
    buildQueryString(params) {
        if (!params || Object.keys(params).length === 0) {
            return '';
        }

        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                if (Array.isArray(value)) {
                    // Handle array parameters
                    value.forEach(item => searchParams.append(key, item.toString()));
                } else if (typeof value === 'object') {
                    // Handle object parameters (flatten them)
                    Object.entries(value).forEach(([subKey, subValue]) => {
                        if (subValue !== null && subValue !== undefined && subValue !== '') {
                            searchParams.append(`${key}.${subKey}`, subValue.toString());
                        }
                    });
                } else {
                    searchParams.append(key, value.toString());
                }
            }
        });

        return searchParams.toString();
    }

    /**
     * Parse response based on content type
     */
    _parseResponse(response) {
        const contentType = response.headers['content-type'] || '';
        const data = response.data;

        // Already parsed JSON by axios
        if (contentType.includes('application/json')) {
            return {
                type: 'json',
                data: data,
                raw: JSON.stringify(data)
            };
        }

        // CSV or CSV-like response
        if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
            return {
                type: 'csv',
                data: this._parseCSV(data),
                raw: data
            };
        }

        // Plain text response
        if (contentType.includes('text/plain') || typeof data === 'string') {
            return {
                type: 'text',
                data: data.trim(),
                raw: data
            };
        }

        // XML response (basic parsing)
        if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
            return {
                type: 'xml',
                data: data,
                raw: data
            };
        }

        // Default: return as-is
        return {
            type: 'unknown',
            data: data,
            raw: data
        };
    }

    /**
     * Parse CSV data into structured format
     */
    _parseCSV(csvString) {
        if (typeof csvString !== 'string') {
            return [];
        }

        const lines = csvString.trim().split('\n');
        if (lines.length === 0) {
            return [];
        }

        // Get headers from first line
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Parse data rows
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            return row;
        });

        return {
            headers,
            rows: data,
            count: data.length
        };
    }

    /**
     * Enhanced error mapping
     */
    _mapError(error) {
        const mappedError = {
            name: 'NellobytesHttpError',
            message: error.message,
            status: error.response?.status || 500,
            code: this._getErrorCode(error),
            type: this._getErrorType(error),
            retryable: this._isRetryableError(error),
            timestamp: new Date().toISOString(),
            originalError: error.message
        };

        // Add response data if available
        if (error.response?.data) {
            mappedError.responseData = error.response.data;
        }

        // Add specific error details based on status code
        if (error.response?.status) {
            mappedError.details = this._getErrorDetails(error.response.status);
        }

        return mappedError;
    }

    /**
     * Get error code from error response
     */
    _getErrorCode(error) {
        // Try to extract error code from response
        if (error.response?.data?.error_code) {
            return error.response.data.error_code;
        }
        
        if (error.response?.data?.code) {
            return error.response.data.code;
        }

        // Map HTTP status to error codes
        const statusCodeMap = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            429: 'RATE_LIMITED',
            500: 'INTERNAL_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
            504: 'GATEWAY_TIMEOUT'
        };

        return statusCodeMap[error.response?.status] || 'UNKNOWN_ERROR';
    }

    /**
     * Get error type classification
     */
    _getErrorType(error) {
        if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
            return 'NETWORK_ERROR';
        }
        
        if (error.code === 'ETIMEDOUT') {
            return 'TIMEOUT_ERROR';
        }

        if (error.response?.status >= 400 && error.response?.status < 500) {
            return 'CLIENT_ERROR';
        }

        if (error.response?.status >= 500) {
            return 'SERVER_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Check if error is retryable
     */
    _isRetryableError(error) {
        const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
        const retryableErrorCodes = ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'];
        
        return (
            retryableStatusCodes.includes(error.response?.status) ||
            retryableErrorCodes.includes(error.code) ||
            error.message.includes('timeout')
        );
    }

    /**
     * Get detailed error information
     */
    _getErrorDetails(statusCode) {
        const errorDetails = {
            400: 'Bad Request - Check your request parameters',
            401: 'Unauthorized - Check your credentials',
            403: 'Forbidden - You do not have permission for this action',
            404: 'Not Found - The requested resource was not found',
            409: 'Conflict - There was a conflict with the current state',
            422: 'Unprocessable Entity - Validation failed',
            429: 'Too Many Requests - Rate limit exceeded',
            500: 'Internal Server Error - Something went wrong on the server',
            502: 'Bad Gateway - Invalid response from upstream server',
            503: 'Service Unavailable - Service is temporarily unavailable',
            504: 'Gateway Timeout - Server took too long to respond'
        };

        return errorDetails[statusCode] || 'Unknown error occurred';
    }

    /**
     * Sleep function for retry delays
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calculate exponential backoff delay
     */
    _getRetryDelay(attempt) {
        const baseDelay = this.retryDelay;
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // Add some jitter
        
        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    /**
     * Execute GET request with retry logic
     */
    async get(endpoint, params = {}, options = {}) {
        const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const queryString = this.buildQueryString(params);
        const fullUrl = queryString ? `${url}?${queryString}` : url;

        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const requestConfig = {
                    method: 'GET',
                    url: fullUrl,
                    ...options
                };

                const response = await this.client.request(requestConfig);
                const parsedResponse = this._parseResponse(response);

                return {
                    success: true,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    ...parsedResponse,
                    meta: {
                        attempt,
                        endpoint: fullUrl,
                        timestamp: new Date().toISOString()
                    }
                };

            } catch (error) {
                lastError = this._mapError(error);
                
                // Don't retry if it's not a retryable error
                if (!lastError.retryable || attempt === this.retryAttempts) {
                    break;
                }

                // Wait before retrying
                const delay = this._getRetryDelay(attempt);
                console.warn(`[NellobytesHTTP] Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this._sleep(delay);
            }
        }

        return {
            success: false,
            error: lastError,
            meta: {
                attempts: this.retryAttempts,
                endpoint: fullUrl,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Quick methods for common endpoints
     */
    async getNetworks(params = {}) {
        return this.get(config.getNellobytesEndpoint('networks'), params);
    }

    async getDataPlans(networkId, params = {}) {
        const queryParams = { network: networkId, ...params };
        return this.get(config.getNellobytesEndpoint('dataPlans'), queryParams);
    }

    async getBalance(params = {}) {
        return this.get(config.getNellobytesEndpoint('balance'), params);
    }

    async getTransactionStatus(transactionId, params = {}) {
        const endpoint = `${config.getNellobytesEndpoint('status')}/${transactionId}`;
        return this.get(endpoint, params);
    }

    /**
     * Test connection to the API
     */
    async testConnection() {
        try {
            console.log('[NellobytesHTTP] Testing API connection...');
            const result = await this.getBalance();
            
            if (result.success) {
                console.log('✅ Nellobytes HTTP Helper connection successful');
                return {
                    success: true,
                    message: 'Connection successful',
                    data: result.data
                };
            } else {
                console.error('❌ Nellobytes HTTP Helper connection failed:', result.error.message);
                return {
                    success: false,
                    message: 'Connection failed',
                    error: result.error
                };
            }
        } catch (error) {
            console.error('❌ Nellobytes HTTP Helper connection error:', error.message);
            return {
                success: false,
                message: 'Connection error',
                error: error.message
            };
        }
    }

    /**
     * Get helper configuration summary
     */
    getConfigSummary() {
        return {
            baseURL: this.baseURL,
            timeout: this.timeout,
            retryAttempts: this.retryAttempts,
            retryDelay: this.retryDelay,
            authType: this.config.authType,
            hasSecretKey: !!this.config.secretKey,
            endpoints: Object.keys(this.config.endpoints)
        };
    }
}

// Create and export singleton instance
const nellobytesHttpHelper = new NellobytesHttpHelper();

module.exports = nellobytesHttpHelper;
