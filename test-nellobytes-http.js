const nellobytesHttpHelper = require('./utils/nellobytesHttpHelper');

/**
 * Test file to demonstrate the usage of the new Nellobytes HTTP Helper
 * Run this with: node test-nellobytes-http.js
 */

async function testNellobytesHttpHelper() {
    console.log('🔧 Testing Nellobytes HTTP Helper...\n');

    // Display configuration summary
    console.log('📋 Configuration Summary:');
    const config = nellobytesHttpHelper.getConfigSummary();
    console.log(JSON.stringify(config, null, 2));
    console.log('');

    // Test 1: Query String Builder
    console.log('🔨 Testing Query String Builder:');
    const params = {
        network: 'mtn',
        amount: 100,
        phone: '08012345678',
        filters: {
            status: 'active',
            type: 'data'
        },
        tags: ['prepaid', 'bulk']
    };
    const queryString = nellobytesHttpHelper.buildQueryString(params);
    console.log('Input:', JSON.stringify(params, null, 2));
    console.log('Output:', queryString);
    console.log('');

    // Test 2: Connection Test
    console.log('🔗 Testing API Connection:');
    const connectionResult = await nellobytesHttpHelper.testConnection();
    console.log('Result:', JSON.stringify(connectionResult, null, 2));
    console.log('');

    // Test 3: Get Networks (if connection successful)
    if (connectionResult.success) {
        console.log('🌐 Testing Get Networks:');
        const networksResult = await nellobytesHttpHelper.getNetworks();
        console.log('Result:', JSON.stringify(networksResult, null, 2));
        console.log('');

        // Test 4: Get Balance
        console.log('💰 Testing Get Balance:');
        const balanceResult = await nellobytesHttpHelper.getBalance();
        console.log('Result:', JSON.stringify(balanceResult, null, 2));
        console.log('');

        // Test 5: Get Data Plans for MTN
        console.log('📊 Testing Get Data Plans:');
        const dataPlansResult = await nellobytesHttpHelper.getDataPlans('mtn', {
            type: 'prepaid',
            limit: 10
        });
        console.log('Result:', JSON.stringify(dataPlansResult, null, 2));
        console.log('');
    }

    // Test 6: Error Handling - Invalid Endpoint
    console.log('❌ Testing Error Handling (Invalid Endpoint):');
    const errorResult = await nellobytesHttpHelper.get('/invalid-endpoint');
    console.log('Result:', JSON.stringify(errorResult, null, 2));
    console.log('');

    // Test 7: Custom GET Request with Parameters
    console.log('🔍 Testing Custom GET Request:');
    const customResult = await nellobytesHttpHelper.get('networks', {
        format: 'json',
        include: 'prices'
    });
    console.log('Result:', JSON.stringify(customResult, null, 2));

    console.log('\n✅ Nellobytes HTTP Helper testing completed!');
}

// Run tests
testNellobytesHttpHelper().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
