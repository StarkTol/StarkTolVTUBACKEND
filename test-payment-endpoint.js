#!/usr/bin/env node

/**
 * Test script to verify payment endpoint is working
 * Run this to check if your backend payment routes are properly configured
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/environment');

// Simulate the app setup
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Test the config loading
console.log('🧪 Testing Backend Configuration...\n');

console.log('📋 Configuration Summary:');
console.log(`   Environment: ${config.env}`);
console.log(`   Server Port: ${config.server.port}`);
console.log(`   API Prefix: ${config.server.apiPrefix}`);
console.log(`   CORS Origins: ${config.server.corsOrigin.join(', ')}`);
console.log(`   Base URL: ${process.env.BASE_URL}`);
console.log(`   Frontend URL: ${process.env.FRONTEND_URL}\n`);

// Test Flutterwave config
console.log('💳 Flutterwave Configuration:');
console.log(`   Public Key: ${process.env.FLW_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Secret Key: ${process.env.FLW_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Encryption Key: ${process.env.FLW_ENCRYPTION_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Webhook Hash: ${process.env.FLW_WEBHOOK_HASH ? '✅ Set' : '❌ Missing'}\n`);

// Test route loading
try {
    const paymentRoutes = require('./routes/payment');
    const paymentController = require('./controllers/paymentController');
    console.log('📡 Route Loading:');
    console.log('   Payment routes: ✅ Loaded');
    console.log('   Payment controller: ✅ Loaded');
    
    // Test if controller has required methods
    if (paymentController.initiatePayment) {
        console.log('   initiatePayment method: ✅ Available');
    } else {
        console.log('   initiatePayment method: ❌ Missing');
    }
    
    if (paymentController.handlePaymentCallback) {
        console.log('   handlePaymentCallback method: ✅ Available');
    } else {
        console.log('   handlePaymentCallback method: ❌ Missing');
    }
    
} catch (error) {
    console.log('📡 Route Loading:');
    console.log(`   ❌ Error loading routes: ${error.message}`);
}

console.log('\n🎯 Expected Endpoints:');
console.log(`   Payment Initiate: POST ${process.env.BASE_URL}${config.server.apiPrefix}/payment/initiate`);
console.log(`   Payment Verify: POST ${process.env.BASE_URL}${config.server.apiPrefix}/payment/verify`);
console.log(`   Payment Status: GET ${process.env.BASE_URL}${config.server.apiPrefix}/payment/status/:tx_ref`);
console.log(`   Webhook: POST ${process.env.BASE_URL}/webhook/flutterwave`);

console.log('\n🧪 Test completed!\n');

// If everything looks good, offer to start a test server
if (process.argv.includes('--server')) {
    console.log('🚀 Starting test server...\n');
    
    // Import and register routes
    try {
        const paymentRoutes = require('./routes/payment');
        app.use(`${config.server.apiPrefix}/payment`, paymentRoutes);
        
        // Test endpoint
        app.get('/test', (req, res) => {
            res.json({
                success: true,
                message: 'Test server is working!',
                timestamp: new Date().toISOString(),
                config: {
                    apiPrefix: config.server.apiPrefix,
                    environment: config.env,
                    cors: config.server.corsOrigin
                }
            });
        });
        
        const PORT = config.server.port;
        app.listen(PORT, () => {
            console.log(`✅ Test server running on port ${PORT}`);
            console.log(`🌐 Test URL: http://localhost:${PORT}/test`);
            console.log(`💳 Payment endpoint: http://localhost:${PORT}${config.server.apiPrefix}/payment/initiate`);
            console.log('\nPress Ctrl+C to stop the server\n');
        });
        
    } catch (error) {
        console.error('❌ Failed to start test server:', error.message);
        process.exit(1);
    }
} else {
    console.log('💡 Run with --server flag to start a test server');
    console.log('   Example: node test-payment-endpoint.js --server\n');
}
