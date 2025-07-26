const path = require('path');

// Load environment variables - only if .env file exists
try {
    require('dotenv').config();
} catch (error) {
    console.log('ℹ️ No .env file found, using environment variables from system');
}

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
        this._loadClubkonnectConfig();
        this._loadSecurityConfig();
        this._validateRequiredConfig();
    }

    /**
     * Load server configuration
     */
    _loadServerConfig() {
        // Use Render's dynamic PORT or fallback to 8000 for local development
        const port = process.env.PORT || 8000;
        this.server = {
            port: parseInt(port, 10),
            apiPrefix: process.env.API_PREFIX || '/api/v1',
            apiVersion: process.env.API_VERSION || 'v1',
            corsOrigin: this._getArray('CORS_ORIGIN', [
                'http://localhost:8000', 
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
     * Load Clubkonnect configuration with validation and defaults
     */
    _loadClubkonnectConfig() {
        this.clubkonnect = {
            // Core API Configuration
            baseUrl: process.env.CLUBKONNECT_BASE_URL || 'https://www.clubkonnect.com',
            userId: process.env.CLUBKONNECT_USERID,
            email: process.env.CLUBKONNECT_EMAIL,
            apiKey: process.env.CLUBKONNECT_API_KEY,
            
            // API Settings
            timeout: this._getNumber('CLUBKONNECT_TIMEOUT', 30000),
            retryAttempts: this._getNumber('CLUBKONNECT_RETRY_ATTEMPTS', 3),
            retryDelay: this._getNumber('CLUBKONNECT_RETRY_DELAY', 5000),
            
            // Callback Configuration
            callbackUrl: process.env.CLUBKONNECT_CALLBACK_URL || `${this._getBaseUrl()}/api/v1/vtu/callback`,
            
            // Service Endpoints
            endpoints: {
                airtime: '/api/topup/',
                data: '/api/data/',
                cable: '/api/cablesub/',
                electricity: '/api/billpayment/',
                balance: '/api/balance/',
                verify: '/api/verify/',
                transaction: '/api/requery/'
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
            // Database - Required for core functionality
            'database.supabase.url',
            'database.supabase.anonKey',
            'database.supabase.serviceRoleKey',
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

        // Only validate Clubkonnect if credentials are provided
        if (this.clubkonnect.userId && this.clubkonnect.apiKey) {
            this._validateClubkonnectConfig();
        } else {
            console.log('ℹ️ Clubkonnect credentials not provided - VTU services will be disabled');
        }
    }

    /**
     * Validate Clubkonnect specific configuration
     */
    _validateClubkonnectConfig() {
        const { clubkonnect } = this;
        
        // Validate timeout
        if (clubkonnect.timeout < 1000 || clubkonnect.timeout > 60000) {
            throw new Error('CLUBKONNECT_TIMEOUT must be between 1000 and 60000 milliseconds');
        }

        // Validate retry configuration
        if (clubkonnect.retryAttempts < 1 || clubkonnect.retryAttempts > 10) {
            throw new Error('CLUBKONNECT_RETRY_ATTEMPTS must be between 1 and 10');
        }

        if (clubkonnect.retryDelay < 1000 || clubkonnect.retryDelay > 30000) {
            throw new Error('CLUBKONNECT_RETRY_DELAY must be between 1000 and 30000 milliseconds');
        }

        // Validate URLs
        if (!this._isValidUrl(clubkonnect.baseUrl)) {
            throw new Error('CLUBKONNECT_BASE_URL must be a valid URL');
        }

        if (clubkonnect.callbackUrl && !this._isValidUrl(clubkonnect.callbackUrl)) {
            throw new Error('CLUBKONNECT_CALLBACK_URL must be a valid URL');
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
     * Get Clubkonnect full endpoint URL
     */
    getClubkonnectEndpoint(endpoint) {
        const endpointPath = this.clubkonnect.endpoints[endpoint];
        if (!endpointPath) {
            throw new Error(`Unknown Clubkonnect endpoint: ${endpoint}`);
        }
        
        return `${this.clubkonnect.baseUrl}${endpointPath}`;
    }

    /**
     * Get Clubkonnect authentication parameters
     */
    getClubkonnectAuthParams() {
        return {
            userid: this.clubkonnect.userId,
            apikey: this.clubkonnect.apiKey
        };
    }

    /**
     * Log configuration summary (without sensitive data)
     */
    logConfigSummary() {
        console.log('📋 Configuration Summary:');
        console.log(`   Environment: ${this.env}`);
        console.log(`   Server Port: ${this.server.port}`);
        console.log(`   API Prefix: ${this.server.apiPrefix}`);
        console.log(`   Clubkonnect Base URL: ${this.clubkonnect.baseUrl}`);
        console.log(`   Clubkonnect User ID: ${this.clubkonnect.userId ? 'Configured' : 'Missing'}`);
        console.log(`   Database: Supabase (${this.database.supabase.url ? 'Configured' : 'Missing'})`);
    }
}

// Create and export singleton instance
const config = new Config();

module.exports = config;
