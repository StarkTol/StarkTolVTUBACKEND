#!/usr/bin/env node

/**
 * Minimal Server Startup for Render Deployment
 * This provides better error handling and debugging information
 */

console.log('🚀 Starting StarkTol VTU Backend - Minimal Mode');
console.log('============================================');

// Environment check
console.log(`📍 Node.js Version: ${process.version}`);
console.log(`📍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`📍 PORT: ${process.env.PORT || 'not set (will use 8000)'}`);

// Load dotenv if available
try {
    require('dotenv').config();
    console.log('✅ dotenv loaded successfully');
} catch (error) {
    console.log('ℹ️ dotenv not available, using system environment variables');
}

// Check critical environment variables
const criticalEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY'
];

console.log('\n🔍 Checking critical environment variables:');
let missingVars = [];
for (const varName of criticalEnvVars) {
    if (process.env[varName]) {
        console.log(`✅ ${varName}: Set`);
    } else {
        console.log(`❌ ${varName}: Missing`);
        missingVars.push(varName);
    }
}

if (missingVars.length > 0) {
    console.error(`\n❌ Missing critical environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these variables in your Render environment settings.');
    process.exit(1);
}

// Load Express
console.log('\n📦 Loading dependencies...');
const express = require('express');
console.log('✅ Express loaded');

const app = express();
const PORT = process.env.PORT || 8000;

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API is running (minimal mode)',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// Render health check endpoint (fast response)
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API is operational (minimal mode)',
        services: {
            server: 'running',
            environment: 'configured'
        },
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol VTU Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            status: '/api/status'
        }
    });
});

// Catch all other routes
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
console.log('\n🌐 Starting server...');
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n✅ Server started successfully!');
    console.log('================================');
    console.log(`🌐 Server URL: http://0.0.0.0:${PORT}`);
    console.log(`💊 Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔍 Render Health: http://0.0.0.0:${PORT}/healthz`);
    console.log(`📊 Status Check: http://0.0.0.0:${PORT}/api/status`);
    console.log('================================');
    console.log('🎉 Ready to receive requests!');
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
    
    setTimeout(() => {
        console.log('⚠️ Graceful shutdown taking longer than expected, but completing...');
        process.exit(0); // Changed from 1 to 0 to indicate successful shutdown
    }, 5000); // Reduced timeout for minimal server
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    console.error('This usually indicates a programming error.');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
    process.exit(1);
});

console.log('\n✨ Minimal server setup complete!');
