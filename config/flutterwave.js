const crypto = require('crypto');
const config = require('./environment');

/**
 * Flutterwave API Configuration
 */
class FlutterwaveConfig {
    constructor() {
        this.publicKey = process.env.FLW_PUBLIC_KEY;
        this.secretKey = process.env.FLW_SECRET_KEY;
        this.encryptionKey = process.env.FLW_ENCRYPTION_KEY;
        this.webhookHash = process.env.FLW_WEBHOOK_HASH;

        this.baseUrl = process.env.FLW_BASE_URL || 'https://api.flutterwave.com';
        this.apiVersion = process.env.FLW_API_VERSION || 'v3';
        this.timeout = parseInt(process.env.FLW_TIMEOUT) || 30000; // 30 seconds

        // Validate required configuration
        this._validateConfig();
    }

    /**
     * Validate required configuration
     */
    _validateConfig() {
        const required = ['publicKey', 'secretKey', 'encryptionKey', 'webhookHash'];
        const missing = required.filter(field => !this[field]);

        if (missing.length > 0) {
            throw new Error(`Missing Flutterwave configuration: ${missing.join(', ')}`);
        }
    }

    /**
     * Get API endpoints
     */
    get endpoints() {
        const baseEndpoint = `${this.baseUrl}/${this.apiVersion}`;

        return {
            payments: `${baseEndpoint}/payments`,
            transfers: `${baseEndpoint}/transfers`,
            charge: `${baseEndpoint}/charges`,
            virtualAccounts: `${baseEndpoint}/virtual-account-numbers`,
            transactionVerify: `${baseEndpoint}/transactions/verify`,
        };
    }

    /**
     * Get request headers
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.secretKey}`,
        };
    }

    /**
     * Encrypt sensitive data
     */
    encryptData(data) {
        const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, this.encryptionKey.slice(0, 16));
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }

    /**
     * Validate webhook signature
     */
    validateWebhookSignature(signature, payload) {
        const hash = crypto
            .createHmac('sha256', this.webhookHash)
            .update(payload)
            .digest('hex');

        return hash === signature;
    }

    /**
     * Parse API response
     */
    parseResponse(response) {
        try {
            return typeof response === 'string' ? JSON.parse(response) : response;
        } catch (error) {
            throw new Error(`Failed to parse Flutterwave response: ${error.message}`);
        }
    }

    /**
     * Check if response indicates success
     */
    isSuccessResponse(response) {
        return response && response.status && response.status.toLowerCase() === 'success';
    }

    /**
     * Get error message from response
     */
    getErrorMessage(response) {
        return response && response.message || 'Unknown error from Flutterwave API';
    }
}

// Singleton instance
const flutterwaveConfig = new FlutterwaveConfig();

module.exports = {
    flutterwaveConfig,
    FlutterwaveConfig
};
