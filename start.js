#!/usr/bin/env node

/**
 * StarkTol VTU Backend Startup Script
 * This script tests connections and starts the server
 */

const config = require('./config/environment');
const path = require('path');

console.log('🚀 StarkTol VTU Backend Starting...\n');

// Test connections first
async function testConnections() {
    console.log('🔧 Testing backend connections...');
    
    try {
        // Configuration is already validated by the config service
        console.log('✅ Configuration validated successfully!');
        config.logConfigSummary();

        // Test Supabase connection with safe error handling
        const { supabase } = require('./config/supabase');
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*', { count: 'exact' })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.warn('⚠️ Warning: Database connection issue:', error.message);
                console.warn('   Supabase may be temporarily unreachable. Continuing startup.');
            } else {
                console.log('✅ Database connection verified successfully.');
            }
        } catch (err) {
            console.warn('⚠️ Warning: Exception during database connection:', err.message);
            console.warn('   Supabase may be temporarily unreachable. Continuing startup.');
        }

        console.log('\n✅ All connections verified (or warnings issued). Proceeding...\n');

    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        process.exit(1);
    }
}

// Start the server
async function startServer() {
    try {
        await testConnections();
        
        console.log('🌟 Starting Express server...\n');
        
        // Load the main application
        require('./index.js');
        
    } catch (error) {
        console.error('🔥 Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Gracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Gracefully shutting down...');
    process.exit(0);
});

// Start the application
startServer();
