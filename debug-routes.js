#!/usr/bin/env node

/**
 * Backend Route Diagnostic Script
 * This script will help identify issues with route registration and configuration
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('🔍 BACKEND ROUTE DIAGNOSTIC SCRIPT');
console.log('=====================================\n');

// 1. Check environment variables
console.log('1. ENVIRONMENT VARIABLES:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   PORT: ${process.env.PORT}`);
console.log(`   API_PREFIX: ${process.env.API_PREFIX}`);
console.log(`   BASE_URL: ${process.env.BASE_URL}`);
console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN}\n`);

// 2. Test config loading
console.log('2. CONFIG LOADING:');
try {
    const config = require('./config/environment');
    console.log('   ✅ Config loaded successfully');
    console.log(`   API Prefix: ${config.server.apiPrefix}`);
    console.log(`   Port: ${config.server.port}`);
    console.log(`   CORS Origins: ${config.server.corsOrigin.join(', ')}\n`);
} catch (error) {
    console.log(`   ❌ Config loading failed: ${error.message}\n`);
}

// 3. Check route files exist
console.log('3. ROUTE FILES:');
const routeFiles = [
    './routes/payment.js',
    './routes/status.js',
    './routes/auth.js',
    './routes/wallet.js',
    './routes/user.js',
    './routes/webhook.js'
];

routeFiles.forEach(routeFile => {
    try {
        const route = require(routeFile);
        console.log(`   ✅ ${routeFile} - Loaded`);
    } catch (error) {
        console.log(`   ❌ ${routeFile} - Error: ${error.message}`);
    }
});

// 4. Check controller files
console.log('\n4. CONTROLLER FILES:');
const controllerFiles = [
    './controllers/paymentController.js',
    './controllers/authController.js',
    './controllers/walletController.js',
    './controllers/userController.js'
];

controllerFiles.forEach(controllerFile => {
    try {
        const controller = require(controllerFile);
        console.log(`   ✅ ${controllerFile} - Loaded`);
        
        // Check for specific methods
        if (controllerFile.includes('payment')) {
            if (controller.initiatePayment) {
                console.log('      - initiatePayment method: ✅');
            } else {
                console.log('      - initiatePayment method: ❌');
            }
            if (controller.handlePaymentCallback) {
                console.log('      - handlePaymentCallback method: ✅');
            }
        }
    } catch (error) {
        console.log(`   ❌ ${controllerFile} - Error: ${error.message}`);
    }
});

// 5. Test basic Express app setup
console.log('\n5. EXPRESS APP TEST:');
try {
    const app = express();
    const config = require('./config/environment');
    
    // Basic middleware
    app.use(cors({
        origin: config.server.corsOrigin,
        credentials: true
    }));
    app.use(express.json());
    
    // Try to register payment routes
    const paymentRoutes = require('./routes/payment');
    app.use(`${config.server.apiPrefix}/payment`, paymentRoutes);
    console.log('   ✅ Payment routes registered successfully');
    
    // Test route
    app.get('/test', (req, res) => {
        res.json({ message: 'Test endpoint working' });
    });
    
    console.log('   ✅ Express app setup successful');
    
    // List all registered routes
    console.log('\n6. REGISTERED ROUTES:');
    const routes = [];
    app._router.stack.forEach(middleware => {
        if (middleware.route) {
            routes.push({
                method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                path: middleware.route.path
            });
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach(handler => {
                if (handler.route) {
                    const basePath = middleware.regexp.source
                        .replace('\\/?', '')
                        .replace('(?=\\/|$)', '')
                        .replace(/\\\//g, '/')
                        .replace(/\$.*/, '');
                    
                    routes.push({
                        method: Object.keys(handler.route.methods)[0].toUpperCase(),
                        path: basePath + handler.route.path
                    });
                }
            });
        }
    });
    
    routes.forEach(route => {
        console.log(`   ${route.method} ${route.path}`);
    });
    
} catch (error) {
    console.log(`   ❌ Express app setup failed: ${error.message}`);
}

// 6. Check specific endpoints
console.log('\n7. EXPECTED ENDPOINTS:');
const config = require('./config/environment');
const baseUrl = process.env.BASE_URL || `http://localhost:${config.server.port}`;
console.log(`   Base URL: ${baseUrl}`);
console.log(`   Payment Initiate: POST ${baseUrl}${config.server.apiPrefix}/payment/initiate`);
console.log(`   Payment Verify: POST ${baseUrl}${config.server.apiPrefix}/payment/verify`);
console.log(`   Stats Usage: GET ${baseUrl}${config.server.apiPrefix}/stats/usage`);
console.log(`   Health Check: GET ${baseUrl}/health`);

// 7. Check if stats route exists
console.log('\n8. STATS ROUTE CHECK:');
try {
    const fs = require('fs');
    const statsFile = './routes/stats.js';
    if (fs.existsSync(statsFile)) {
        console.log('   ✅ Stats route file exists');
        const stats = require(statsFile);
        console.log('   ✅ Stats route loaded');
    } else {
        console.log('   ❌ Stats route file missing - need to create /routes/stats.js');
    }
} catch (error) {
    console.log(`   ❌ Stats route error: ${error.message}`);
}

console.log('\n=====================================');
console.log('🏁 DIAGNOSTIC COMPLETE');
console.log('=====================================\n');

// Start test server if requested
if (process.argv.includes('--server')) {
    console.log('🚀 Starting test server...\n');
    
    try {
        const app = express();
        const config = require('./config/environment');
        
        // Middleware
        app.use(cors({
            origin: config.server.corsOrigin,
            credentials: true
        }));
        app.use(express.json());
        
        // Test route
        app.get('/test', (req, res) => {
            res.json({
                success: true,
                message: 'Test server is working!',
                timestamp: new Date().toISOString(),
                environment: config.env,
                apiPrefix: config.server.apiPrefix
            });
        });
        
        // Register existing routes
        try {
            const paymentRoutes = require('./routes/payment');
            app.use(`${config.server.apiPrefix}/payment`, paymentRoutes);
            console.log('✅ Payment routes registered');
        } catch (error) {
            console.log(`❌ Payment routes failed: ${error.message}`);
        }
        
        // 404 handler
        app.all('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: `Endpoint not found: ${req.method} ${req.path}`,
                timestamp: new Date().toISOString()
            });
        });
        
        const PORT = config.server.port;
        app.listen(PORT, () => {
            console.log(`✅ Test server running on port ${PORT}`);
            console.log(`🌐 Test URL: http://localhost:${PORT}/test`);
            console.log(`💳 Payment endpoint: http://localhost:${PORT}${config.server.apiPrefix}/payment/initiate`);
            console.log('\nTry these commands to test:');
            console.log(`curl http://localhost:${PORT}/test`);
            console.log(`curl http://localhost:${PORT}${config.server.apiPrefix}/payment/initiate`);
            console.log('\nPress Ctrl+C to stop\n');
        });
        
    } catch (error) {
        console.error('❌ Failed to start test server:', error.message);
    }
} else {
    console.log('💡 Run with --server to start a test server');
    console.log('   node debug-routes.js --server\n');
}
