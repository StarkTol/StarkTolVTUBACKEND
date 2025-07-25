const config = require('./environment');

/**
 * ClubKonnect VTU API Configuration
 * Centralized configuration for ClubKonnect service integration
 */
class ClubKonnectConfig {
    constructor() {
        // Load environment variables
        this.userId = process.env.CLUBKONNECT_USERID;
        this.apiKey = process.env.CLUBKONNECT_APIKEY;
        this.callbackUrl = process.env.CLUBKONNECT_CALLBACK_URL;
        
            // API Configuration
            this.baseUrl = process.env.CLUBKONNECT_BASE_URL || 'https://www.clubkonnect.com';
        this.apiVersion = process.env.CLUBKONNECT_API_VERSION || 'v1';
        this.timeout = parseInt(process.env.CLUBKONNECT_TIMEOUT) || 30000; // 30 seconds
        this.retryAttempts = parseInt(process.env.CLUBKONNECT_RETRY_ATTEMPTS) || 3;
        this.retryDelay = parseInt(process.env.CLUBKONNECT_RETRY_DELAY) || 5000; // 5 seconds
        
        // Validate required fields
        this._validateConfig();
    }

    /**
     * Validate required configuration
     */
    _validateConfig() {
        const required = ['userId', 'apiKey'];
        const missing = required.filter(field => !this[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing ClubKonnect configuration: ${missing.join(', ')}`);
        }
    }

    /**
     * Get API endpoints
     */
    get endpoints() {
        const baseEndpoint = `${this.baseUrl}`;
        
        return {
            // Core VTU Services
            airtime: `${baseEndpoint}/APIAirtimeV1.asp`,
            data: `${baseEndpoint}/APIDataV1.asp`,
            cable: `${baseEndpoint}/APICableTVV1.asp`,
            electricity: `${baseEndpoint}/APIElectricityV1.asp`,
            
            // PIN Services  
            waecPin: `${baseEndpoint}/APIWaecPINV1.asp`,
            jambPin: `${baseEndpoint}/APIJambPINV1.asp`,
            rechargePins: `${baseEndpoint}/APIPrintRechargePINV1.asp`,
            
            // Utility Endpoints
            balance: `${baseEndpoint}/APIBalanceV1.asp`,
            transactionStatus: `${baseEndpoint}/APITransactionStatusV1.asp`,
            dataplans: `${baseEndpoint}/APIDataPlansV1.asp`,
            networks: `${baseEndpoint}/APINetworksV1.asp`,
            
            // Callback endpoints
            callback: this.callbackUrl || `${config._getBaseUrl()}/api/v1/vtu/callback/clubkonnect`,
            webhook: `${config._getBaseUrl()}/api/v1/webhook/clubkonnect`
        };
    }

    /**
     * Get authentication parameters for API calls
     */
    getAuthParams() {
        return {
            UserID: this.userId,
            APIKey: this.apiKey
        };
    }

    /**
     * Get request headers
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'StarkTol-VTU/1.0'
        };
    }

    /**
     * Get complete request configuration for HTTP client
     */
    getRequestConfig(additionalParams = {}) {
        return {
            timeout: this.timeout,
            headers: this.getHeaders(),
            params: {
                ...this.getAuthParams(),
                ...additionalParams
            }
        };
    }

    /**
     * Generate transaction reference
     */
    generateTransactionRef(prefix = 'CK') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Validate webhook signature (if implemented by ClubKonnect)
     */
    validateWebhook(payload, signature) {
        // Implement webhook signature validation if ClubKonnect provides it
        // For now, return true as ClubKonnect may not have webhook signatures
        return true;
    }

    /**
     * Get service-specific configurations
     */
    getServiceConfig(service) {
        const configs = {
            airtime: {
                endpoint: this.endpoints.airtime,
                requiredParams: ['UserID', 'APIKey', 'MobileNumber', 'NetworkID', 'Amount', 'RequestID'],
                responseFormat: 'json'
            },
            data: {
                endpoint: this.endpoints.data,
                requiredParams: ['UserID', 'APIKey', 'MobileNumber', 'DataPlan', 'RequestID'],
                responseFormat: 'json'
            },
            cable: {
                endpoint: this.endpoints.cable,
                requiredParams: ['UserID', 'APIKey', 'CableTV', 'CableTVNumber', 'CablePlan', 'RequestID'],
                responseFormat: 'json'
            },
            electricity: {
                endpoint: this.endpoints.electricity,
                requiredParams: ['UserID', 'APIKey', 'ElectricCompany', 'MeterNumber', 'MeterType', 'Amount', 'RequestID'],
                responseFormat: 'json'
            },
            balance: {
                endpoint: this.endpoints.balance,
                requiredParams: ['UserID', 'APIKey'],
                responseFormat: 'json'
            }
        };

        return configs[service] || null;
    }

    /**
     * Map network names to ClubKonnect network IDs
     */
    get networkMapping() {
        return {
            'MTN': '01',
            'GLO': '02',
            'AIRTEL': '03',
            '9MOBILE': '04',
            'ETISALAT': '04' // Alias for 9MOBILE
        };
    }

    /**
     * Get network ID from network name
     */
    getNetworkId(networkName) {
        return this.networkMapping[networkName?.toUpperCase()] || null;
    }

    /**
     * Parse ClubKonnect API response
     */
    parseResponse(response, expectedFormat = 'json') {
        try {
            if (expectedFormat === 'json') {
                return typeof response === 'string' ? JSON.parse(response) : response;
            }
            return response;
        } catch (error) {
            throw new Error(`Failed to parse ClubKonnect response: ${error.message}`);
        }
    }

    /**
     * Check if response indicates success
     */
    isSuccessResponse(response) {
        // ClubKonnect success indicators (adjust based on actual API responses)
        const successIndicators = [
            'successful', 'success', 'completed', 'processed'
        ];
        
        const responseText = JSON.stringify(response).toLowerCase();
        return successIndicators.some(indicator => responseText.includes(indicator));
    }

    /**
     * Get error message from response
     */
    getErrorMessage(response) {
        if (typeof response === 'string') {
            return response;
        }
        
        return response?.message || 
               response?.error || 
               response?.description || 
               'Unknown error from ClubKonnect API';
    }
}

// Create singleton instance
const clubkonnectConfig = new ClubKonnectConfig();

module.exports = {
    clubkonnectConfig,
    ClubKonnectConfig
};
