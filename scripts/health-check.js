#!/usr/bin/env node

/**
 * Health Check Script for StarkTol VTU Backend
 * This script verifies that the deployed backend is working correctly
 */

const https = require('https');
const http = require('http');

async function checkEndpoint(url, expectedKeys = []) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const request = client.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    
                    // Check status code
                    if (response.statusCode !== 200) {
                        return reject(`HTTP ${response.statusCode}: ${json.message || 'Unknown error'}`);
                    }
                    
                    // Check expected keys
                    for (const key of expectedKeys) {
                        if (!(key in json)) {
                            return reject(`Missing expected key: ${key}`);
                        }
                    }
                    
                    resolve(json);
                } catch (error) {
                    reject(`Invalid JSON response: ${error.message}`);
                }
            });
        });
        
        request.on('error', (error) => {
            reject(`Network error: ${error.message}`);
        });
        
        request.setTimeout(10000, () => {
            request.destroy();
            reject('Request timeout after 10 seconds');
        });
    });
}

async function runHealthCheck() {
    const baseUrl = process.argv[2] || 'http://localhost:8000';
    
    console.log('🔍 Running health check for StarkTol VTU Backend...');
    console.log(`📍 Base URL: ${baseUrl}\n`);
    
    const tests = [
        {
            name: 'Health Endpoint',
            url: `${baseUrl}/health`,
            expectedKeys: ['success', 'message', 'timestamp', 'environment']
        },
        {
            name: 'API Status',
            url: `${baseUrl}/api/status`,
            expectedKeys: ['success', 'message', 'services', 'timestamp']
        },
        {
            name: 'API Documentation',
            url: `${baseUrl}/api/v1/docs`,
            expectedKeys: ['success', 'message', 'endpoints']
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            console.log(`🧪 Testing ${test.name}...`);
            const result = await checkEndpoint(test.url, test.expectedKeys);
            
            console.log(`✅ ${test.name}: PASSED`);
            console.log(`   Status: ${result.success ? 'Success' : 'Failed'}`);
            console.log(`   Message: ${result.message}`);
            
            if (test.name === 'Health Endpoint') {
                console.log(`   Environment: ${result.environment}`);
                console.log(`   Version: ${result.version || 'Not specified'}`);
            }
            
            console.log('');
            passed++;
            
        } catch (error) {
            console.log(`❌ ${test.name}: FAILED`);
            console.log(`   Error: ${error}`);
            console.log('');
            failed++;
        }
    }
    
    console.log('📊 Health Check Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All health checks passed! Your backend is ready to serve requests.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some health checks failed. Please review the errors above.');
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    process.exit(1);
});

// Show usage if no URL provided
if (process.argv.length < 3) {
    console.log('🔧 Usage:');
    console.log('  node scripts/health-check.js <base-url>');
    console.log('');
    console.log('📝 Examples:');
    console.log('  node scripts/health-check.js http://localhost:8000');
    console.log('  node scripts/health-check.js https://your-backend.onrender.com');
    console.log('');
    console.log('🚀 Running with default URL (localhost:8000)...\n');
}

runHealthCheck().catch((error) => {
    console.error('💥 Health check failed to run:', error);
    process.exit(1);
});
