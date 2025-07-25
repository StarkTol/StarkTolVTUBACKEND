#!/usr/bin/env node

/**
 * StarkTol VTU - Flutterwave Setup Script
 * 
 * This script helps set up the Flutterwave wallet funding system:
 * - Creates database tables
 * - Validates environment variables
 * - Tests Flutterwave connection
 * - Creates sample data (optional)
 */

const { supabase } = require('../config/supabase');
const { flutterwaveService } = require('../services/flutterwaveService');
const fs = require('fs');
const path = require('path');

class FlutterwaveSetup {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.success = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🔷',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        }[type];

        console.log(`${prefix} [${timestamp}] ${message}`);
        
        if (type === 'error') this.errors.push(message);
        if (type === 'warning') this.warnings.push(message);
        if (type === 'success') this.success.push(message);
    }

    async validateEnvironment() {
        this.log('Validating environment variables...', 'info');

        const requiredVars = [
            'FLW_PUBLIC_KEY',
            'FLW_SECRET_KEY', 
            'FLW_ENCRYPTION_KEY',
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'FRONTEND_URL'
        ];

        const optionalVars = [
            'FLW_WEBHOOK_HASH',
            'BASE_URL'
        ];

        // Check required variables
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                this.log(`Missing required environment variable: ${varName}`, 'error');
            } else {
                this.log(`✓ ${varName} is set`, 'success');
            }
        }

        // Check optional variables
        for (const varName of optionalVars) {
            if (!process.env[varName]) {
                this.log(`Optional environment variable not set: ${varName}`, 'warning');
            } else {
                this.log(`✓ ${varName} is set`, 'success');
            }
        }

        // Validate key formats
        if (process.env.FLW_PUBLIC_KEY && !process.env.FLW_PUBLIC_KEY.startsWith('FLWPUBK_')) {
            this.log('FLW_PUBLIC_KEY format appears incorrect (should start with FLWPUBK_)', 'warning');
        }

        if (process.env.FLW_SECRET_KEY && !process.env.FLW_SECRET_KEY.startsWith('FLWSECK_')) {
            this.log('FLW_SECRET_KEY format appears incorrect (should start with FLWSECK_)', 'warning');
        }

        return this.errors.length === 0;
    }

    async testSupabaseConnection() {
        this.log('Testing Supabase connection...', 'info');

        try {
            const { data, error } = await supabase
                .from('users')
                .select('count')
                .limit(1);

            if (error) {
                this.log(`Supabase connection failed: ${error.message}`, 'error');
                return false;
            }

            this.log('Supabase connection successful', 'success');
            return true;
        } catch (error) {
            this.log(`Supabase connection error: ${error.message}`, 'error');
            return false;
        }
    }

    async testFlutterwaveConnection() {
        this.log('Testing Flutterwave API connection...', 'info');

        try {
            // Create a test payment link
            const testPayment = await flutterwaveService.createPaymentLink({
                amount: 100,
                userId: 'test-user-id',
                userEmail: 'test@example.com',
                userName: 'Test User',
                userPhone: '+2348123456789',
                description: 'Test payment for setup validation'
            });

            if (testPayment.success) {
                this.log('Flutterwave API connection successful', 'success');
                this.log(`Test payment link: ${testPayment.paymentLink}`, 'info');
                return true;
            } else {
                this.log('Flutterwave API test failed: Payment link creation failed', 'error');
                return false;
            }
        } catch (error) {
            this.log(`Flutterwave API connection error: ${error.message}`, 'error');
            return false;
        }
    }

    async createDatabaseSchema() {
        this.log('Creating database schema...', 'info');

        try {
            const schemaPath = path.join(__dirname, '../database/flutterwave-wallet-schema.sql');
            
            if (!fs.existsSync(schemaPath)) {
                this.log(`Schema file not found: ${schemaPath}`, 'error');
                return false;
            }

            const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute the schema
            const { error } = await supabase.rpc('exec_sql', { sql: schemaSQL });
            
            if (error) {
                this.log(`Database schema creation failed: ${error.message}`, 'error');
                return false;
            }

            this.log('Database schema created successfully', 'success');
            return true;
        } catch (error) {
            this.log(`Schema creation error: ${error.message}`, 'error');
            return false;
        }
    }

    async verifyTables() {
        this.log('Verifying database tables...', 'info');

        const requiredTables = [
            'wallets',
            'payment_logs', 
            'transactions',
            'wallet_limits',
            'wallet_logs',
            'flutterwave_webhooks'
        ];

        let allTablesExist = true;

        for (const tableName of requiredTables) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(1);

                if (error) {
                    this.log(`Table '${tableName}' verification failed: ${error.message}`, 'error');
                    allTablesExist = false;
                } else {
                    this.log(`✓ Table '${tableName}' exists and accessible`, 'success');
                }
            } catch (error) {
                this.log(`Error checking table '${tableName}': ${error.message}`, 'error');
                allTablesExist = false;
            }
        }

        return allTablesExist;
    }

    async createSampleWallet(userId = 'sample-user-123') {
        this.log('Creating sample wallet for testing...', 'info');

        try {
            // Check if wallet already exists
            const { data: existingWallet } = await supabase
                .from('wallets')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (existingWallet) {
                this.log('Sample wallet already exists', 'warning');
                return true;
            }

            // Create sample wallet
            const { data, error } = await supabase
                .from('wallets')
                .insert({
                    user_id: userId,
                    balance: 0,
                    total_deposits: 0,
                    total_withdrawals: 0,
                    currency: 'NGN'
                })
                .select()
                .single();

            if (error) {
                this.log(`Failed to create sample wallet: ${error.message}`, 'error');
                return false;
            }

            this.log(`Sample wallet created with ID: ${data.id}`, 'success');
            return true;
        } catch (error) {
            this.log(`Sample wallet creation error: ${error.message}`, 'error');
            return false;
        }
    }

    async runHealthCheck() {
        this.log('Running system health check...', 'info');

        const checks = [
            { name: 'Environment Variables', fn: () => this.validateEnvironment() },
            { name: 'Supabase Connection', fn: () => this.testSupabaseConnection() },
            { name: 'Flutterwave API', fn: () => this.testFlutterwaveConnection() },
            { name: 'Database Tables', fn: () => this.verifyTables() }
        ];

        let allPassed = true;

        for (const check of checks) {
            this.log(`\n--- ${check.name} ---`, 'info');
            const result = await check.fn();
            if (!result) {
                allPassed = false;
            }
        }

        return allPassed;
    }

    async displaySummary() {
        console.log('\n' + '='.repeat(60));
        console.log('                SETUP SUMMARY');
        console.log('='.repeat(60));

        if (this.success.length > 0) {
            console.log('\n✅ SUCCESSFUL OPERATIONS:');
            this.success.forEach(msg => console.log(`  • ${msg}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(msg => console.log(`  • ${msg}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.errors.forEach(msg => console.log(`  • ${msg}`));
        }

        console.log('\n' + '='.repeat(60));
        
        if (this.errors.length === 0) {
            console.log('🎉 SETUP COMPLETED SUCCESSFULLY!');
            console.log('\nNext steps:');
            console.log('1. Start your server: npm start');
            console.log('2. Test payment initiation from frontend');
            console.log('3. Configure webhook URL in Flutterwave dashboard');
            console.log('4. Test complete payment flow with test cards');
        } else {
            console.log('❌ SETUP FAILED - Please fix the errors above');
            console.log('\nFor help, check:');
            console.log('• docs/FLUTTERWAVE_API_DOCUMENTATION.md');
            console.log('• Environment variables in .env file');
            console.log('• Supabase configuration');
        }

        console.log('='.repeat(60));
    }

    async run(options = {}) {
        console.log('🚀 StarkTol VTU - Flutterwave Setup');
        console.log('=====================================\n');

        try {
            // Environment validation
            const envValid = await this.validateEnvironment();
            if (!envValid) {
                this.log('Environment validation failed. Cannot continue.', 'error');
                await this.displaySummary();
                process.exit(1);
            }

            // Database setup
            if (options.createSchema) {
                await this.createDatabaseSchema();
            }

            // Run health check
            const healthOk = await this.runHealthCheck();

            // Create sample data if requested
            if (options.createSample && healthOk) {
                await this.createSampleWallet();
            }

            // Display summary
            await this.displaySummary();

            // Exit with appropriate code
            process.exit(this.errors.length > 0 ? 1 : 0);

        } catch (error) {
            this.log(`Setup failed with error: ${error.message}`, 'error');
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// CLI handling
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        createSchema: args.includes('--create-schema'),
        createSample: args.includes('--create-sample'),
        healthCheck: args.includes('--health-check') || args.length === 0
    };

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
StarkTol VTU - Flutterwave Setup Script

Usage: node scripts/setup-flutterwave.js [options]

Options:
  --create-schema    Create database tables from schema file
  --create-sample    Create sample data for testing
  --health-check     Run system health check (default)
  --help, -h         Show this help message

Examples:
  node scripts/setup-flutterwave.js                    # Health check only
  node scripts/setup-flutterwave.js --create-schema    # Create schema + health check
  node scripts/setup-flutterwave.js --create-sample    # Create sample data + health check
  node scripts/setup-flutterwave.js --create-schema --create-sample   # Full setup

Environment Variables Required:
  FLW_PUBLIC_KEY              Flutterwave public key
  FLW_SECRET_KEY              Flutterwave secret key  
  FLW_ENCRYPTION_KEY          Flutterwave encryption key
  SUPABASE_URL                Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY   Supabase service role key
  FRONTEND_URL                Frontend application URL

Optional:
  FLW_WEBHOOK_HASH            Webhook signature verification
  BASE_URL                    Backend base URL
        `);
        process.exit(0);
    }

    const setup = new FlutterwaveSetup();
    setup.run(options);
}

module.exports = FlutterwaveSetup;
