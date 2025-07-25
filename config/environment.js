const path = require('path');

// Load environment variables
require('dotenv').config();

/**
 * Configuration service for environment variables
 * Provides validation, defaults, and easy access to all config values
 */
class Config {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.isDevelopment = this.env === 'development';
        this.isProduction = this.env === 'production';
        this.isTest = this.env === 'test';
        
        // Load and validate all configurations
        this._loadServerConfig();
        this._loadDatabaseConfig();
        this._loadNellobytesConfig();
        this._loadSecurityConfig();
        this._validateRequiredConfig();
    }

    /**
     * Load server configuration
     */
    _loadServerConfig() {
        this.server = {
            port: this._getNumber('PORT', 8000),
            apiPrefix: process.env.API_PREFIX || '/api/v1',
            apiVersion: process.env.API_VERSION || 'v1',
            corsOrigin: this._getArray('CORS_ORIGIN', [
                'http://localhost:3000', 
                'http://localhost:5000'
            ]),
        };
    }

    /**
     * Load database configuration
     */
    _loadDatabaseConfig() {
        this.database = {
            supabase: {
                url: process.env.SUPABASE_URL,
                anonKey: process.env.SUPABASE_ANON_KEY,
                serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            }
        };
    }

    /**
     * Load Nellobytesystems configuration with validation and defaults
     */
    _loadNellobytesConfig() {
        this.nellobytes = {
            // Core API Configuration
            baseUrl: process.env.NELLOBYTES_BASE_URL || 'https://api.nellobytesystems.com',
            username: process.env.NELLOBYTES_USERNAME,
            password: process.env.NELLOBYTES_PASSWORD,
            apiKey: process.env.NELLOBYTES_API_KEY,
            secretKey: process.env.NELLOBYTES_SECRET_KEY,
            
            // Authentication & API Settings
            authType: process.env.NELLOBYTES_AUTH_TYPE || 'bearer',
            apiVersion: process.env.NELLOBYTES_API_VERSION || 'v1',
            timeout: this._getNumber('NELLOBYTES_TIMEOUT', 30000),
            rateLimit: this._getNumber('NELLOBYTES_RATE_LIMIT', 60),
            retryAttempts: this._getNumber('NELLOBYTES_RETRY_ATTEMPTS', 3),
            retryDelay: this._getNumber('NELLOBYTES_RETRY_DELAY', 5000),
            
            // Callback & Webhook Configuration
            callbackUrl: process.env.NELLOBYTES_CALLBACK_URL || `${this._getBaseUrl()}/api/v1/callback/nellobytes`,
            webhookUrl: process.env.NELLOBYTES_WEBHOOK_URL || `${this._getBaseUrl()}/api/v1/webhook/nellobytes`,
            webhookSecret: process.env.NELLOBYTES_WEBHOOK_SECRET,
            
            // Service Endpoints
            endpoints: {
                networks: process.env.NELLOBYTES_NETWORKS_ENDPOINT || '/networks',
                dataPlans: process.env.NELLOBYTES_DATA_PLANS_ENDPOINT || '/data-plans',
                airtime: process.env.NELLOBYTES_AIRTIME_ENDPOINT || '/APIAirtimeV1.asp',
                data: process.env.NELLOBYTES_DATA_ENDPOINT || '/data',
                cable: process.env.NELLOBYTES_CABLE_ENDPOINT || '/cable-tv',
                electricity: process.env.NELLOBYTES_ELECTRICITY_ENDPOINT || '/electricity',
                balance: process.env.NELLOBYTES_BALANCE_ENDPOINT || '/balance',
                status: process.env.NELLOBYTES_STATUS_ENDPOINT || '/transaction-status',
                // Additional endpoints for the 7 transaction methods
                buyData: process.env.NELLOBYTES_BUY_DATA_ENDPOINT || '/APIDataV1.asp',
                payCableTV: process.env.NELLOBYTES_PAY_CABLE_TV_ENDPOINT || '/APICableTVV1.asp',
                payElectricity: process.env.NELLOBYTES_PAY_ELECTRICITY_ENDPOINT || '/APIElectricityV1.asp',
                printRechargePIN: process.env.NELLOBYTES_PRINT_RECHARGE_PIN_ENDPOINT || '/APIPrintRechargePINV1.asp',
                buyWaecPIN: process.env.NELLOBYTES_BUY_WAEC_PIN_ENDPOINT || '/APIWaecPINV1.asp',
                buyJambPIN: process.env.NELLOBYTES_BUY_JAMB_PIN_ENDPOINT || '/APIJambPINV1.asp'
            }
        };
    }

    /**
     * Load security and rate limiting configuration
     */
    _loadSecurityConfig() {
        this.security = {
            rateLimiting: {
                windowMs: this._getNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
                maxRequests: this._getNumber('RATE_LIMIT_MAX_REQUESTS', 100),
            }
        };
    }

    /**
     * Validate required configuration values
     */
    _validateRequiredConfig() {
        const requiredFields = [
            // Database
            'database.supabase.url',
            'database.supabase.anonKey',
            'database.supabase.serviceRoleKey',
            
            // Nellobytes critical fields
            'nellobytes.baseUrl',
            'nellobytes.username',
            'nellobytes.password',
        ];

        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!this._getNestedValue(field)) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
        }

        // Validate Nellobytes configuration
        this._validateNellobytesConfig();
    }

    /**
     * Validate Nellobytes specific configuration
     */
    _validateNellobytesConfig() {
        const { nellobytes } = this;
        
        // Validate auth type
        const validAuthTypes = ['bearer', 'basic', 'apikey'];
        if (!validAuthTypes.includes(nellobytes.authType)) {
            throw new Error(`Invalid NELLOBYTES_AUTH_TYPE: ${nellobytes.authType}. Must be one of: ${validAuthTypes.join(', ')}`);
        }

        // Validate timeout
        if (nellobytes.timeout < 1000 || nellobytes.timeout > 60000) {
            throw new Error('NELLOBYTES_TIMEOUT must be between 1000 and 60000 milliseconds');
        }

        // Validate rate limit
        if (nellobytes.rateLimit < 1 || nellobytes.rateLimit > 1000) {
            throw new Error('NELLOBYTES_RATE_LIMIT must be between 1 and 1000 requests per minute');
        }

        // Validate retry configuration
        if (nellobytes.retryAttempts < 1 || nellobytes.retryAttempts > 10) {
            throw new Error('NELLOBYTES_RETRY_ATTEMPTS must be between 1 and 10');
        }

        if (nellobytes.retryDelay < 1000 || nellobytes.retryDelay > 30000) {
            throw new Error('NELLOBYTES_RETRY_DELAY must be between 1000 and 30000 milliseconds');
        }

        // Validate URLs
        if (!this._isValidUrl(nellobytes.baseUrl)) {
            throw new Error('NELLOBYTES_BASE_URL must be a valid URL');
        }

        if (nellobytes.callbackUrl && !this._isValidUrl(nellobytes.callbackUrl)) {
            throw new Error('NELLOBYTES_CALLBACK_URL must be a valid URL');
        }

        if (nellobytes.webhookUrl && !this._isValidUrl(nellobytes.webhookUrl)) {
            throw new Error('NELLOBYTES_WEBHOOK_URL must be a valid URL');
        }
    }

    /**
     * Get array from environment variable
     */
    _getArray(envVar, defaultValue = []) {
        const value = process.env[envVar];
        if (!value) return defaultValue;
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }

    /**
     * Get number from environment variable
     */
    _getNumber(envVar, defaultValue) {
        const value = process.env[envVar];
        if (!value) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * Get boolean from environment variable
     */
    _getBoolean(envVar, defaultValue = false) {
        const value = process.env[envVar];
        if (!value) return defaultValue;
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }

    /**
     * Get nested value from configuration object
     */
    _getNestedValue(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this);
    }

    /**
     * Validate URL format
     */
    _isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Get base URL for the application
     */
    _getBaseUrl() {
        if (this.isProduction) {
            return process.env.BASE_URL || 'https://api.yourdomain.com';
        }
        return `http://localhost:${this.server.port}`;
    }

    /**
     * Get Nellobytes full endpoint URL
     */
    getNellobytesEndpoint(endpoint) {
        const endpointPath = this.nellobytes.endpoints[endpoint];
        if (!endpointPath) {
            throw new Error(`Unknown Nellobytes endpoint: ${endpoint}`);
        }
        
        return `${this.nellobytes.baseUrl}${this.nellobytes.apiVersion ? `/${this.nellobytes.apiVersion}` : ''}${endpointPath}`;
    }

    /**
     * Get Nellobytes authentication headers
     */
    getNellobytesAuthHeaders() {
        const { nellobytes } = this;
        
        switch (nellobytes.authType) {
            case 'bearer':
                return {
                    'Authorization': `Bearer ${nellobytes.apiKey || nellobytes.secretKey}`,
                    'Content-Type': 'application/json'
                };
                
            case 'basic':
                const credentials = Buffer.from(`${nellobytes.username}:${nellobytes.password}`).toString('base64');
                return {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                };
                
            case 'apikey':
                return {
                    'X-API-Key': nellobytes.apiKey,
                    'Content-Type': 'application/json'
                };
                
            default:
                throw new Error(`Unsupported auth type: ${nellobytes.authType}`);
        }
    }

    /**
     * Log configuration summary (without sensitive data)
     */
    logConfigSummary() {
        console.log('📋 Configuration Summary:');
        console.log(`   Environment: ${this.env}`);
        console.log(`   Server Port: ${this.server.port}`);
        console.log(`   API Prefix: ${this.server.apiPrefix}`);
        console.log(`   Nellobytes Base URL: ${this.nellobytes.baseUrl}`);
        console.log(`   Nellobytes Auth Type: ${this.nellobytes.authType}`);
        console.log(`   Nellobytes Rate Limit: ${this.nellobytes.rateLimit}/min`);
        console.log(`   Database: Supabase (${this.database.supabase.url ? 'Configured' : 'Missing'})`);
    }
}

// Create and export singleton instance
const config = new Config();

module.exports = config;
