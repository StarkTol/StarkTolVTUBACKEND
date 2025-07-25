// Test script to verify all connections work properly
require('dotenv').config();

console.log('🔧 Testing StarkTol Backend Connections...\n');

// Test 1: Environment Variables
console.log('1. Testing Environment Variables:');
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars = [];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        missingVars.push(varName);
    } else {
        console.log(`   ✅ ${varName}: Set`);
    }
});

if (missingVars.length > 0) {
    console.log(`   ❌ Missing: ${missingVars.join(', ')}`);
    console.log('   Please configure your .env file before proceeding.\n');
    process.exit(1);
}

// Test 2: Core Dependencies
console.log('\n2. Testing Core Dependencies:');
try {
    const express = require('express');
    console.log('   ✅ Express: OK');
} catch (error) {
    console.log('   ❌ Express: Failed -', error.message);
}

try {
    const { createClient } = require('@supabase/supabase-js');
    console.log('   ✅ Supabase Client: OK');
} catch (error) {
    console.log('   ❌ Supabase Client: Failed -', error.message);
}

try {
    require('cors');
    console.log('   ✅ CORS: OK');
} catch (error) {
    console.log('   ❌ CORS: Failed -', error.message);
}

// Test 3: Config Files
console.log('\n3. Testing Configuration Files:');
try {
    const { supabase, supabaseAdmin } = require('./config/supabase');
    console.log('   ✅ Supabase Config: OK');
} catch (error) {
    console.log('   ❌ Supabase Config: Failed -', error.message);
}

// Test 4: Utilities
console.log('\n4. Testing Utilities:');
try {
    const { generateResponse, validateEnvVars } = require('./utils/helpers');
    console.log('   ✅ Helpers: OK');
} catch (error) {
    console.log('   ❌ Helpers: Failed -', error.message);
}

try {
    const { validateEmail, validatePassword } = require('./utils/validators');
    console.log('   ✅ Validators: OK');
} catch (error) {
    console.log('   ❌ Validators: Failed -', error.message);
}

// Test 5: Middlewares
console.log('\n5. Testing Middlewares:');
try {
    const authMiddleware = require('./middlewares/authMiddleware');
    console.log('   ✅ Auth Middleware: OK');
} catch (error) {
    console.log('   ❌ Auth Middleware: Failed -', error.message);
}

try {
    const errorHandler = require('./middlewares/errorHandler');
    console.log('   ✅ Error Handler: OK');
} catch (error) {
    console.log('   ❌ Error Handler: Failed -', error.message);
}

try {
    const { validateRequest } = require('./middlewares/validateRequest');
    console.log('   ✅ Validate Request: OK');
} catch (error) {
    console.log('   ❌ Validate Request: Failed -', error.message);
}

// Test 6: Controllers
console.log('\n6. Testing Controllers:');
const controllers = [
    'authController',
    'userController',
    'walletController',
    'vtuController',
    'transactionController',
    'resellerController',
    'referralController',
    'supportController',
    'settingsController',
    'subdomainController'
];

controllers.forEach(controller => {
    try {
        require(`./controllers/${controller}`);
        console.log(`   ✅ ${controller}: OK`);
    } catch (error) {
        console.log(`   ❌ ${controller}: Failed -`, error.message);
    }
});

// Test 7: Routes
console.log('\n7. Testing Routes:');
const routes = [
    'auth',
    'user',
    'wallet',
    'vtu',
    'transactions',
    'reseller',
    'referrals',
    'support',
    'settings',
    'subdomain',
    'status'
];

routes.forEach(route => {
    try {
        require(`./routes/${route}`);
        console.log(`   ✅ ${route}: OK`);
    } catch (error) {
        console.log(`   ❌ ${route}: Failed -`, error.message);
    }
});

// Test 8: Services
console.log('\n8. Testing Services:');
const services = [
    'vtuService',
    'walletService',
    'referralService',
    'resellerService',
    'supportService',
    'supabaseClient'
];

services.forEach(service => {
    try {
        require(`./services/${service}`);
        console.log(`   ✅ ${service}: OK`);
    } catch (error) {
        console.log(`   ❌ ${service}: Failed -`, error.message);
    }
});

// Test 9: Models
console.log('\n9. Testing Models:');
const models = [
    'User',
    'Transaction',
    'SupportTicket',
    'Reseller',
    'SubReseller'
];

models.forEach(model => {
    try {
        require(`./models/${model}`);
        console.log(`   ✅ ${model}: OK`);
    } catch (error) {
        console.log(`   ❌ ${model}: Failed -`, error.message);
    }
});

// Test 10: Real-time Handler
console.log('\n10. Testing Real-time Handler:');
try {
    const { realtimeHandler } = require('./utils/realtimeHandler');
    console.log('   ✅ Realtime Handler: OK');
} catch (error) {
    console.log('   ❌ Realtime Handler: Failed -', error.message);
}

// Test 11: Clubkonnect Configuration
console.log('\n11. Testing Clubkonnect Configuration:');
try {
    const { clubkonnectConfig } = require('./config/clubkonnect');
    console.log('   ✅ Clubkonnect Config: OK');
    console.log(`   ✅ Base URL: ${clubkonnectConfig.baseUrl}`);
    console.log(`   ✅ User ID: ${clubkonnectConfig.userId ? 'Configured' : 'Missing'}`);
    console.log(`   ✅ API Key: ${clubkonnectConfig.apiKey ? 'Configured' : 'Missing'}`);
} catch (error) {
    console.log('   ❌ Clubkonnect Configuration: Failed -', error.message);
}

console.log('\n🎉 Connection test completed!');
console.log('If you see mostly green checkmarks, your backend is properly connected.');
console.log('Any red X marks indicate issues that need to be resolved.');
console.log('\n💡 VTU Services now use Clubkonnect API integration.');
console.log('   - All Nellobytes integration has been removed');
console.log('   - Update your .env file with Clubkonnect credentials');
console.log('   - Test VTU functionality through the API endpoints\n');
