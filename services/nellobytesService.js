const config = require('../config/environment');
const nellobytesHttpHelper = require('../utils/nellobytesHttpHelper');
const ProviderError = require('../utils/ProviderError');
const { generateReference } = require('../utils/helpers');

/**
 * Nellobytesystems VTU Service
 * Implements the 7 required transaction methods with standardized response format
 */
class NellobytesService {
    constructor() {
        this.config = config.nellobytes;
        this.httpHelper = nellobytesHttpHelper;
        this.providerName = 'Nellobytes';
    }

    /**
     * Parse provider response and extract status codes
     */
    _parseProviderResponse(response) {
        // Handle different response formats from Nellobytes
        let data = response.data;
        
        // If response is string, try to parse as JSON
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // Handle plain text responses (common with Nellobytes)
                data = { message: data };
            }
        }
        
        return {
            status: response.status,
            statusText: response.statusText,
            data: data,
            raw: response.data
        };
    }

    /**
     * Check if provider response indicates success
     */
    _isSuccessResponse(parsedResponse) {
        const { data } = parsedResponse;
        
        // Common success indicators for Nellobytes
        if (data.status === 'success' || data.success === true) {
            return true;
        }
        
        // Check for successful status codes in response
        if (data.status_code && (data.status_code === '200' || data.status_code === 200)) {
            return true;
        }
        
        // Check HTTP status code
        return parsedResponse.status >= 200 && parsedResponse.status < 300;
    }

    /**
     * Extract balance from provider response
     */
    _extractBalance(data) {
        return data.balance || data.account_balance || data.wallet_balance || null;
    }

    /**
     * Extract provider reference from response
     */
    _extractProviderRef(data) {
        return data.transaction_id || data.ref || data.reference || data.transaction_ref || null;
    }

    // ===== THE 7 REQUIRED TRANSACTION METHODS =====

    /**
     * 1. Buy Airtime - APIAirtimeV1.asp
     */
    async buyAirtime({ network, amount, phone, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('AIR');
            const endpoint = config.getNellobytesEndpoint('airtime');
            
            const params = {
                network,
                amount,
                phone,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to buy airtime');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'Airtime purchase successful',
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 2. Buy Data - APIDataV1.asp
     */
    async buyData({ network, plan, phone, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('DATA');
            const endpoint = config.getNellobytesEndpoint('buyData');
            
            const params = {
                network,
                plan,
                phone,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to buy data');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'Data purchase successful',
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 3. Pay Cable TV - APICableTVV1.asp
     */
    async payCableTV({ provider, package_id, smartcard_number, amount = null, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('CABLE');
            const endpoint = config.getNellobytesEndpoint('payCableTV');
            
            const params = {
                provider,
                package_id,
                smartcard_number,
                ref: localRef
            };

            if (amount) {
                params.amount = amount;
            }

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to pay cable TV');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'Cable TV payment successful',
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 4. Pay Electricity - APIElectricityV1.asp
     */
    async payElectricity({ provider, meter_number, amount, meter_type = 'prepaid', transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('ELEC');
            const endpoint = config.getNellobytesEndpoint('payElectricity');
            
            const params = {
                provider,
                meter_number,
                amount,
                meter_type,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to pay electricity');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'Electricity payment successful',
                token: parsedResponse.data.token || parsedResponse.data.recharge_pin,
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 5. Print Recharge PIN - APIPrintRechargePINV1.asp
     */
    async printRechargePIN({ network, amount, quantity = 1, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('PIN');
            const endpoint = config.getNellobytesEndpoint('printRechargePIN');
            
            const params = {
                network,
                amount,
                quantity,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to print recharge PIN');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'Recharge PIN generated successfully',
                pins: parsedResponse.data.pins || parsedResponse.data.recharge_pins || [],
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 6. Buy WAEC PIN - APIWaecPINV1.asp
     */
    async buyWaecPIN({ quantity = 1, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('WAEC');
            const endpoint = config.getNellobytesEndpoint('buyWaecPIN');
            
            const params = {
                quantity,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to buy WAEC PIN');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'WAEC PIN purchased successfully',
                pins: parsedResponse.data.pins || parsedResponse.data.waec_pins || [],
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * 7. Buy JAMB PIN - APIJambPINV1.asp
     */
    async buyJambPIN({ quantity = 1, transactionId = null }) {
        try {
            const localRef = transactionId || generateReference('JAMB');
            const endpoint = config.getNellobytesEndpoint('buyJambPIN');
            
            const params = {
                quantity,
                ref: localRef
            };

            const response = await this.httpHelper.get(endpoint, params);
            
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to buy JAMB PIN');
            }

            const parsedResponse = this._parseProviderResponse(response);
            const isSuccess = this._isSuccessResponse(parsedResponse);
            
            if (!isSuccess) {
                throw ProviderError.transactionFailed(this.providerName, parsedResponse.data.message, localRef);
            }

            return {
                success: true,
                providerRef: this._extractProviderRef(parsedResponse.data),
                balance: this._extractBalance(parsedResponse.data),
                transactionId: localRef,
                message: parsedResponse.data.message || 'JAMB PIN purchased successfully',
                pins: parsedResponse.data.pins || parsedResponse.data.jamb_pins || [],
                data: parsedResponse.data
            };

        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Check account balance
     */
    async getBalance() {
        try {
            const response = await this.httpHelper.getBalance();
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to fetch balance');
            }
            return {
                success: true,
                balance: this._extractBalance(response.data),
                data: response.data
            };
        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * Check transaction status
     */
    async getTransactionStatus(transactionId) {
        try {
            const response = await this.httpHelper.getTransactionStatus(transactionId);
            if (!response.success) {
                throw ProviderError.fromProviderResponse(this.providerName, response.error, 'Failed to check transaction status');
            }
            return {
                success: true,
                status: response.data.status || response.data.transaction_status,
                data: response.data
            };
        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw ProviderError.networkError(this.providerName, error);
        }
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.config.webhookSecret) {
            console.warn('[Nellobytes] Webhook secret not configured');
            return false;
        }

        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    /**
     * Handle API errors with retry logic
     */
    async handleError(error, message) {
        const errorResponse = {
            success: false,
            message,
            error: error.message,
            status: error.response?.status || 500
        };

        // Log detailed error in development
        if (config.isDevelopment) {
            console.error('[Nellobytes] Detailed error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    data: error.config?.data
                }
            });
        }

        return errorResponse;
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            console.log('[Nellobytes] Testing API connection...');
            const result = await this.getBalance();
            
            if (result.success) {
                console.log('✅ Nellobytes API connection successful');
                return true;
            } else {
                console.error('❌ Nellobytes API connection failed:', result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Nellobytes API connection error:', error.message);
            return false;
        }
    }

    /**
     * Get service configuration summary
     */
    getConfigSummary() {
        return {
            baseUrl: this.config.baseUrl,
            authType: this.config.authType,
            apiVersion: this.config.apiVersion,
            timeout: this.config.timeout,
            rateLimit: this.config.rateLimit,
            retryAttempts: this.config.retryAttempts,
            retryDelay: this.config.retryDelay,
            hasWebhookSecret: !!this.config.webhookSecret,
            callbackUrl: this.config.callbackUrl,
            webhookUrl: this.config.webhookUrl,
            endpoints: Object.keys(this.config.endpoints)
        };
    }
}

// Create and export singleton instance
const nellobytesService = new NellobytesService();

module.exports = nellobytesService;
