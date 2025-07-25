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

        // Test Supabase connection
        const { supabase } = require('./config/supabase');
        const { data, error } = await supabase.from('users').select('count').limit(1);
        
        if (error) {
            console.error('❌ Database connection failed:', error.message);
            console.log('   Please check your Supabase credentials and database setup.');
            process.exit(1);
        }

        console.log('\n✅ All connections verified successfully!\n');

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
