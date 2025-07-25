/**
 * Custom error class for VTU provider failures
 * Used to handle and standardize errors from various VTU providers
 */
class ProviderError extends Error {
    constructor(message, options = {}) {
        super(message);
        
        this.name = 'ProviderError';
        this.provider = options.provider || 'unknown';
        this.code = options.code || 'PROVIDER_ERROR';
        this.status = options.status || 500;
        this.providerResponse = options.providerResponse || null;
        this.transactionRef = options.transactionRef || null;
        this.retryable = options.retryable || false;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ProviderError);
        }
    }

    /**
     * Convert error to JSON representation
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            provider: this.provider,
            code: this.code,
            status: this.status,
            providerResponse: this.providerResponse,
            transactionRef: this.transactionRef,
            retryable: this.retryable,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    /**
     * Create error from provider response
     */
    static fromProviderResponse(provider, response, message = null) {
        const errorMessage = message || `${provider} provider error`;
        const errorOptions = {
            provider,
            providerResponse: response,
            status: response?.status || 500,
            code: response?.code || response?.error_code || 'PROVIDER_ERROR'
        };

        return new ProviderError(errorMessage, errorOptions);
    }

    /**
     * Create network error
     */
    static networkError(provider, originalError) {
        return new ProviderError(
            `Network error communicating with ${provider}`,
            {
                provider,
                code: 'NETWORK_ERROR',
                status: 503,
                retryable: true,
                providerResponse: originalError.message
            }
        );
    }

    /**
     * Create timeout error
     */
    static timeoutError(provider) {
        return new ProviderError(
            `Request to ${provider} timed out`,
            {
                provider,
                code: 'TIMEOUT_ERROR',
                status: 408,
                retryable: true
            }
        );
    }

    /**
     * Create authentication error
     */
    static authError(provider) {
        return new ProviderError(
            `Authentication failed for ${provider}`,
            {
                provider,
                code: 'AUTH_ERROR',
                status: 401,
                retryable: false
            }
        );
    }

    /**
     * Create insufficient balance error
     */
    static insufficientBalance(provider, balance = null) {
        return new ProviderError(
            'Insufficient balance to complete transaction',
            {
                provider,
                code: 'INSUFFICIENT_BALANCE',
                status: 402,
                retryable: false,
                providerResponse: { balance }
            }
        );
    }

    /**
     * Create transaction failed error
     */
    static transactionFailed(provider, reason = null, transactionRef = null) {
        return new ProviderError(
            reason || 'Transaction failed',
            {
                provider,
                code: 'TRANSACTION_FAILED',
                status: 422,
                retryable: false,
                transactionRef
            }
        );
    }
}

module.exports = ProviderError;
