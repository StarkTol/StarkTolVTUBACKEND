// Test script for Clubkonnect VTU integration
require('dotenv').config();

const { vtuService } = require('./services/vtuService');
const config = require('./config/environment');

console.log('🧪 Testing Clubkonnect VTU Integration...\n');

async function testClubkonnectIntegration() {
    try {
        // Test 1: Configuration
        console.log('1. Testing Configuration:');
        console.log(`   Base URL: ${config.clubkonnect.baseUrl}`);
        console.log(`   User ID: ${config.clubkonnect.userId ? 'Configured' : 'Missing'}`);
        console.log(`   API Key: ${config.clubkonnect.apiKey ? 'Configured' : 'Missing'}`);
        console.log(`   Callback URL: ${config.clubkonnect.callbackUrl}`);
        
        if (!config.clubkonnect.userId || !config.clubkonnect.apiKey) {
            console.log('   ❌ Missing required credentials. Please update your .env file.\n');
            return;
        }
        
        // Test 2: Network Service
        console.log('\n2. Testing Network Service:');
        try {
            const networks = await vtuService.getAvailableNetworks();
            console.log(`   ✅ Available networks: ${networks.length} found`);
            networks.forEach(network => {
                console.log(`      - ${network.name} (${network.code})`);
            });
        } catch (error) {
            console.log('   ❌ Network service failed:', error.message);
        }
        
        // Test 3: Data Plans Service
        console.log('\n3. Testing Data Plans Service:');
        try {
            const dataPlans = await vtuService.getDataPlans('mtn');
            console.log(`   ✅ MTN data plans: ${dataPlans.length} found`);
            if (dataPlans.length > 0) {
                console.log(`      - ${dataPlans[0].name}: ₦${dataPlans[0].price}`);
            }
        } catch (error) {
            console.log('   ❌ Data plans service failed:', error.message);
        }
        
        // Test 4: Cable Providers Service
        console.log('\n4. Testing Cable Providers Service:');
        try {
            const providers = await vtuService.getCableProviders();
            console.log(`   ✅ Cable providers: ${providers.length} found`);
            providers.forEach(provider => {
                console.log(`      - ${provider.name} (${provider.code})`);
            });
        } catch (error) {
            console.log('   ❌ Cable providers service failed:', error.message);
        }
        
        // Test 5: Electricity Providers Service
        console.log('\n5. Testing Electricity Providers Service:');
        try {
            const providers = await vtuService.getElectricityProviders();
            console.log(`   ✅ Electricity providers: ${providers.length} found`);
            if (providers.length > 0) {
                console.log(`      - ${providers[0].name} (${providers[0].code})`);
            }
        } catch (error) {
            console.log('   ❌ Electricity providers service failed:', error.message);
        }
        
        // Test 6: Service Status
        console.log('\n6. Testing Service Status:');
        try {
            const status = await vtuService.checkServiceStatus();
            console.log(`   ✅ Service status: Airtime(${status.airtime}), Data(${status.data}), Cable(${status.cable}), Electricity(${status.electricity})`);
        } catch (error) {
            console.log('   ❌ Service status check failed:', error.message);
        }
        
        console.log('\n🎉 Clubkonnect integration test completed!');
        console.log('\n💡 Ready for live testing:');
        console.log('   - All VTU services are configured to use Clubkonnect API');
        console.log('   - Transaction callbacks will be handled at /api/v1/vtu/callback');
        console.log('   - Update your .env file with production Clubkonnect credentials');
        console.log('   - Test transactions through the API endpoints\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testClubkonnectIntegration();
