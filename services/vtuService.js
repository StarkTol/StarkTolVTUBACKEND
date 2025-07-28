const axios = require('axios');
const { clubkonnectConfig } = require('../config/clubkonnect');
const { supabase } = require('../config/supabase');
const ProviderError = require('../utils/ProviderError');

/**
 * VTU Service for integrating with Clubkonnect API
 * Handles Airtime, Data, Cable TV, and Electricity bill payments
 */
class VTUService {
    constructor() {
        this.config = clubkonnectConfig;
        this.httpClient = axios.create({
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'StarkTol-VTU/1.0'
            }
        });
        
        this.setupInterceptors();
        this.initializeCache();
    }

    /**
     * Set up axios interceptors for logging and error handling
     */
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use(
            (config) => {
                console.log(`📤 ClubKonnect API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('Request error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.httpClient.interceptors.response.use(
            (response) => {
                console.log(`📥 ClubKonnect API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error('Response error:', error.response?.data || error.message);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Initialize cache for service variations
     */
    initializeCache() {
        this.cache = {
            networks: null,
            dataPlans: {},
            cableProviders: null,
            cablePackages: {},
            electricityProviders: null,
            lastUpdated: {}
        };
    }

    /**
     * Check if cached data is still valid (5 minutes)
     */
    isCacheValid(key) {
        const lastUpdated = this.cache.lastUpdated[key];
        if (!lastUpdated) return false;
        return (Date.now() - lastUpdated) < 300000; // 5 minutes
    }

    /**
     * Make authenticated request to Clubkonnect API
     */
    async makeRequest(endpoint, params = {}, method = 'POST') {
        try {
            const authParams = this.config.getAuthParams();
            const allParams = { ...authParams, ...params };
            
            // Convert params to URL-encoded format
            const urlEncoded = new URLSearchParams(allParams).toString();
            
            const response = await this.httpClient({
                method,
                url: endpoint,
                data: urlEncoded,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return this.parseResponse(response.data);
        } catch (error) {
            throw new ProviderError(
                `Clubkonnect API error: ${error.message}`,
                'CLUBKONNECT_ERROR',
                error.response?.status
            );
        }
    }

    /**
     * Parse Clubkonnect API response
     */
    parseResponse(data) {
        // Handle different response formats
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch {
                // If not JSON, check for common response patterns
                if (data.toLowerCase().includes('successful') || data.toLowerCase().includes('success')) {
                    return { status: 'success', message: data };
                } else if (data.toLowerCase().includes('failed') || data.toLowerCase().includes('error')) {
                    return { status: 'failed', message: data };
                }
                return { status: 'unknown', message: data };
            }
        }
        return data;
    }

    /**
     * Get available networks
     */
    async getAvailableNetworks() {
        if (this.cache.networks && this.isCacheValid('networks')) {
            return this.cache.networks;
        }

        try {
            const response = await this.makeRequest(
                this.config.endpoints.networks,
                {},
                'GET'
            );

            // Default networks if API doesn't provide them
            const defaultNetworks = [
                { id: '01', name: 'MTN', code: 'MTN' },
                { id: '02', name: 'GLO', code: 'GLO' },
                { id: '03', name: 'AIRTEL', code: 'AIRTEL' },
                { id: '04', name: '9MOBILE', code: '9MOBILE' }
            ];

            const networks = response.networks || defaultNetworks;
            
            this.cache.networks = networks;
            this.cache.lastUpdated.networks = Date.now();
            
            return networks;
        } catch (error) {
            console.error('Failed to fetch networks:', error);
            // Return default networks if API fails
            const defaultNetworks = [
                { id: '01', name: 'MTN', code: 'MTN' },
                { id: '02', name: 'GLO', code: 'GLO' },
                { id: '03', name: 'AIRTEL', code: 'AIRTEL' },
                { id: '04', name: '9MOBILE', code: '9MOBILE' }
            ];
            return defaultNetworks;
        }
    }

    /**
     * Get data plans for a specific network
     */
    async getDataPlans(network) {
        const cacheKey = `dataPlans_${network}`;
        if (this.cache.dataPlans[network] && this.isCacheValid(cacheKey)) {
            return this.cache.dataPlans[network];
        }

        try {
            const networkId = this.config.getNetworkId(network);
            if (!networkId) {
                throw new Error(`Invalid network: ${network}`);
            }

            const response = await this.makeRequest(
                this.config.endpoints.dataplans,
                { Network: networkId }
            );

            const dataPlans = response.plans || this.getDefaultDataPlans(network);
            
            this.cache.dataPlans[network] = dataPlans;
            this.cache.lastUpdated[cacheKey] = Date.now();
            
            return dataPlans;
        } catch (error) {
            console.error(`Failed to fetch data plans for ${network}:`, error);
            return this.getDefaultDataPlans(network);
        }
    }

    /**
     * Get default data plans for fallback
     */
    getDefaultDataPlans(network) {
        const commonPlans = {
            MTN: [
                { id: 'MTN-1GB-30', name: '1GB - 30 Days', price: 350, data: '1GB', validity: '30 days' },
                { id: 'MTN-2GB-30', name: '2GB - 30 Days', price: 700, data: '2GB', validity: '30 days' },
                { id: 'MTN-5GB-30', name: '5GB - 30 Days', price: 1500, data: '5GB', validity: '30 days' },
                { id: 'MTN-10GB-30', name: '10GB - 30 Days', price: 3000, data: '10GB', validity: '30 days' }
            ],
            GLO: [
                { id: 'GLO-1GB-30', name: '1GB - 30 Days', price: 350, data: '1GB', validity: '30 days' },
                { id: 'GLO-2GB-30', name: '2GB - 30 Days', price: 700, data: '2GB', validity: '30 days' },
                { id: 'GLO-5GB-30', name: '5GB - 30 Days', price: 1500, data: '5GB', validity: '30 days' },
                { id: 'GLO-10GB-30', name: '10GB - 30 Days', price: 3000, data: '10GB', validity: '30 days' }
            ],
            AIRTEL: [
                { id: 'AIRTEL-1GB-30', name: '1GB - 30 Days', price: 350, data: '1GB', validity: '30 days' },
                { id: 'AIRTEL-2GB-30', name: '2GB - 30 Days', price: 700, data: '2GB', validity: '30 days' },
                { id: 'AIRTEL-5GB-30', name: '5GB - 30 Days', price: 1500, data: '5GB', validity: '30 days' },
                { id: 'AIRTEL-10GB-30', name: '10GB - 30 Days', price: 3000, data: '10GB', validity: '30 days' }
            ],
            '9MOBILE': [
                { id: '9MOBILE-1GB-30', name: '1GB - 30 Days', price: 350, data: '1GB', validity: '30 days' },
                { id: '9MOBILE-2GB-30', name: '2GB - 30 Days', price: 700, data: '2GB', validity: '30 days' },
                { id: '9MOBILE-5GB-30', name: '5GB - 30 Days', price: 1500, data: '5GB', validity: '30 days' },
                { id: '9MOBILE-10GB-30', name: '10GB - 30 Days', price: 3000, data: '10GB', validity: '30 days' }
            ]
        };
        return commonPlans[network] || [];
    }

    /**
     * Purchase airtime
     */
    async purchaseAirtime({ network, phone_number, amount }) {
        try {
            const networkId = this.config.getNetworkId(network);
            if (!networkId) {
                throw new Error(`Invalid network: ${network}`);
            }

            const requestId = this.config.generateTransactionRef('AIRTIME');
            
            const params = {
                MobileNumber: phone_number,
                NetworkID: networkId,
                Amount: amount,
                RequestID: requestId
            };

            const response = await this.makeRequest(
                this.config.endpoints.airtime,
                params
            );

            // Log transaction
            await this.logTransaction({
                type: 'airtime',
                network,
                phone_number,
                amount,
                request_id: requestId,
                response,
                status: this.isSuccessResponse(response) ? 'completed' : 'failed'
            });

            return {
                success: this.isSuccessResponse(response),
                reference: requestId,
                message: this.config.getErrorMessage(response),
                data: response
            };
        } catch (error) {
            console.error('Airtime purchase error:', error);
            throw error;
        }
    }

    /**
     * Purchase data
     */
    async purchaseData({ network, phone_number, plan_id, amount }) {
        try {
            const networkId = this.config.getNetworkId(network);
            if (!networkId) {
                throw new Error(`Invalid network: ${network}`);
            }

            const requestId = this.config.generateTransactionRef('DATA');
            
            const params = {
                MobileNumber: phone_number,
                DataPlan: plan_id,
                RequestID: requestId
            };

            const response = await this.makeRequest(
                this.config.endpoints.data,
                params
            );

            // Log transaction
            await this.logTransaction({
                type: 'data',
                network,
                phone_number,
                plan_id,
                amount,
                request_id: requestId,
                response,
                status: this.isSuccessResponse(response) ? 'completed' : 'failed'
            });

            return {
                success: this.isSuccessResponse(response),
                reference: requestId,
                message: this.config.getErrorMessage(response),
                data: response
            };
        } catch (error) {
            console.error('Data purchase error:', error);
            throw error;
        }
    }

    /**
     * Get cable TV providers
     */
    async getCableProviders() {
        if (this.cache.cableProviders && this.isCacheValid('cableProviders')) {
            return this.cache.cableProviders;
        }

        // Default cable providers
        const providers = [
            { id: 'dstv', name: 'DStv', code: 'DSTV' },
            { id: 'gotv', name: 'GOtv', code: 'GOTV' },
            { id: 'startimes', name: 'Startimes', code: 'STARTIMES' }
        ];

        this.cache.cableProviders = providers;
        this.cache.lastUpdated.cableProviders = Date.now();
        
        return providers;
    }

    /**
     * Get cable TV packages
     */
    async getCablePackages(provider) {
        const cacheKey = `cablePackages_${provider}`;
        if (this.cache.cablePackages[provider] && this.isCacheValid(cacheKey)) {
            return this.cache.cablePackages[provider];
        }

        const packages = this.getDefaultCablePackages(provider);
        
        this.cache.cablePackages[provider] = packages;
        this.cache.lastUpdated[cacheKey] = Date.now();
        
        return packages;
    }

    /**
     * Get default cable packages
     */
    getDefaultCablePackages(provider) {
        const packages = {
            dstv: [
                { id: 'dstv-padi', name: 'DStv Padi', price: 2500, code: 'PADI' },
                { id: 'dstv-yanga', name: 'DStv Yanga', price: 3500, code: 'YANGA' },
                { id: 'dstv-confam', name: 'DStv Confam', price: 6000, code: 'CONFAM' },
                { id: 'dstv-compact', name: 'DStv Compact', price: 10500, code: 'COMPACT' },
                { id: 'dstv-compact-plus', name: 'DStv Compact Plus', price: 16600, code: 'COMPACTPLUS' }
            ],
            gotv: [
                { id: 'gotv-lite', name: 'GOtv Lite', price: 410, code: 'LITE' },
                { id: 'gotv-max', name: 'GOtv Max', price: 4850, code: 'MAX' },
                { id: 'gotv-jolli', name: 'GOtv Jolli', price: 3300, code: 'JOLLI' },
                { id: 'gotv-jinja', name: 'GOtv Jinja', price: 2250, code: 'JINJA' }
            ],
            startimes: [
                { id: 'startimes-nova', name: 'Startimes Nova', price: 1300, code: 'NOVA' },
                { id: 'startimes-basic', name: 'Startimes Basic', price: 2200, code: 'BASIC' },
                { id: 'startimes-smart', name: 'Startimes Smart', price: 2800, code: 'SMART' },
                { id: 'startimes-classic', name: 'Startimes Classic', price: 3300, code: 'CLASSIC' }
            ]
        };
        return packages[provider.toLowerCase()] || [];
    }

    /**
     * Validate smartcard number
     */
    async validateSmartcard({ provider, smartcard_number }) {
        try {
            // For now, we'll do basic validation
            // In a real implementation, you'd call Clubkonnect's validation endpoint
            if (!smartcard_number || smartcard_number.length < 10) {
                return {
                    valid: false,
                    message: 'Invalid smartcard number format'
                };
            }

            // Mock validation response
            return {
                valid: true,
                customer_name: 'Customer Name',
                customer_address: 'Customer Address',
                account_status: 'Active'
            };
        } catch (error) {
            console.error('Smartcard validation error:', error);
            return {
                valid: false,
                message: 'Unable to validate smartcard number'
            };
        }
    }

    /**
     * Purchase cable TV subscription
     */
    async purchaseCable({ provider, package_id, smartcard_number, amount }) {
        try {
            const requestId = this.config.generateTransactionRef('CABLE');
            
            const params = {
                CableTV: provider.toUpperCase(),
                CableTVNumber: smartcard_number,
                CablePlan: package_id,
                RequestID: requestId
            };

            const response = await this.makeRequest(
                this.config.endpoints.cable,
                params
            );

            // Log transaction
            await this.logTransaction({
                type: 'cable',
                provider,
                smartcard_number,
                package_id,
                amount,
                request_id: requestId,
                response,
                status: this.isSuccessResponse(response) ? 'completed' : 'failed'
            });

            return {
                success: this.isSuccessResponse(response),
                reference: requestId,
                message: this.config.getErrorMessage(response),
                data: response
            };
        } catch (error) {
            console.error('Cable purchase error:', error);
            throw error;
        }
    }

    /**
     * Get electricity providers (Discos)
     */
    async getElectricityProviders() {
        if (this.cache.electricityProviders && this.isCacheValid('electricityProviders')) {
            return this.cache.electricityProviders;
        }

        const providers = [
            { id: 'ikeja', name: 'Ikeja Electric', code: 'IKEDC' },
            { id: 'eko', name: 'Eko Electricity', code: 'EKEDC' },
            { id: 'abuja', name: 'Abuja Electricity', code: 'AEDC' },
            { id: 'kano', name: 'Kano Electricity', code: 'KEDCO' },
            { id: 'portharcourt', name: 'Port Harcourt Electric', code: 'PHED' },
            { id: 'ibadan', name: 'Ibadan Electricity', code: 'IBEDC' },
            { id: 'jos', name: 'Jos Electricity', code: 'JED' },
            { id: 'kaduna', name: 'Kaduna Electric', code: 'KAEDCO' },
            { id: 'yola', name: 'Yola Electricity', code: 'YEDC' },
            { id: 'benin', name: 'Benin Electricity', code: 'BEDC' }
        ];

        this.cache.electricityProviders = providers;
        this.cache.lastUpdated.electricityProviders = Date.now();
        
        return providers;
    }

    /**
     * Validate meter number
     */
    async validateMeterNumber({ provider, meter_number, meter_type }) {
        try {
            // For now, we'll do basic validation
            // In a real implementation, you'd call Clubkonnect's validation endpoint
            if (!meter_number || meter_number.length < 8) {
                return {
                    valid: false,
                    message: 'Invalid meter number format'
                };
            }

            // Mock validation response
            return {
                valid: true,
                customer_name: 'Customer Name',
                customer_address: 'Customer Address',
                account_type: meter_type,
                tariff_class: 'R2'
            };
        } catch (error) {
            console.error('Meter validation error:', error);
            return {
                valid: false,
                message: 'Unable to validate meter number'
            };
        }
    }

    /**
     * Purchase electricity token
     */
    async purchaseElectricity({ provider, meter_number, meter_type, amount, customer_name }) {
        try {
            const requestId = this.config.generateTransactionRef('ELECTRICITY');
            
            const params = {
                ElectricCompany: provider.toUpperCase(),
                MeterNumber: meter_number,
                MeterType: meter_type.toLowerCase() === 'prepaid' ? '1' : '2',
                Amount: amount,
                RequestID: requestId
            };

            const response = await this.makeRequest(
                this.config.endpoints.electricity,
                params
            );

            // Log transaction
            await this.logTransaction({
                type: 'electricity',
                provider,
                meter_number,
                meter_type,
                amount,
                customer_name,
                request_id: requestId,
                response,
                status: this.isSuccessResponse(response) ? 'completed' : 'failed'
            });

            return {
                success: this.isSuccessResponse(response),
                reference: requestId,
                message: this.config.getErrorMessage(response),
                token: response.token || null,
                data: response
            };
        } catch (error) {
            console.error('Electricity purchase error:', error);
            throw error;
        }
    }

    /**
     * Check if response indicates success
     */
    isSuccessResponse(response) {
        return this.config.isSuccessResponse(response);
    }

    /**
     * Log transaction to database
     */
    async logTransaction(transactionData) {
        try {
            const { error } = await supabase
                .from('vtu_transaction_logs')
                .insert({
                    type: transactionData.type,
                    network: transactionData.network,
                    phone_number: transactionData.phone_number,
                    amount: transactionData.amount,
                    request_id: transactionData.request_id,
                    provider_response: transactionData.response,
                    status: transactionData.status,
                    metadata: {
                        ...transactionData,
                        timestamp: new Date().toISOString()
                    },
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to log VTU transaction:', error);
            }
        } catch (error) {
            console.error('Transaction logging error:', error);
        }
    }

    /**
     * Get account balance from Clubkonnect
     */
    async getBalance() {
        try {
            const response = await this.makeRequest(
                this.config.endpoints.balance,
                {}
            );

            return {
                success: true,
                balance: response.balance || 0,
                currency: 'NGN',
                data: response
            };
        } catch (error) {
            console.error('Balance check error:', error);
            return {
                success: false,
                message: error.message,
                balance: 0
            };
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(requestId) {
        try {
            const response = await this.makeRequest(
                this.config.endpoints.transactionStatus,
                { RequestID: requestId }
            );

            return {
                success: true,
                status: response.status,
                message: response.message,
                data: response
            };
        } catch (error) {
            console.error('Transaction status check error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

// Create singleton instance
const vtuService = new VTUService();

module.exports = {
    vtuService,
    VTUService
};
