/**
 * Test script for Clubkonnect VTU Service Integration
 * This script tests all VTU services: Airtime, Data, Cable, and Electricity
 */

require('dotenv').config();
const { vtuService } = require('./services/vtuService');
const { clubkonnectConfig } = require('./config/clubkonnect');

// Test configuration
const TEST_CONFIG = {
    // Test phone numbers (use your own for testing)
    testPhoneNumber: '08012345678',
    testSmartcard: '1234567890',
    testMeterNumber: '12345678901',
    
    // Test amounts
    airtimeAmount: 100,
    electricityAmount: 1000,
    
    // Test networks
    testNetwork: 'MTN',
    
    // Test providers
    cableProvider: 'dstv',
    electricityProvider: 'ikeja'
};

async function testClubkonnectConnection() {
    console.log('🧪 Testing Clubkonnect VTU Service Integration\n');
    console.log('='.repeat(60));
    
    try {
        // Test 1: Configuration Check
        console.log('\n📋 1. Configuration Check');
        console.log('-'.repeat(30));
        
        console.log('Base URL:', clubkonnectConfig.baseUrl);
        console.log('User ID:', clubkonnectConfig.userId ? '✅ Set' : '❌ Missing');
        console.log('API Key:', clubkonnectConfig.apiKey ? '✅ Set' : '❌ Missing');
        console.log('Endpoints:', Object.keys(clubkonnectConfig.endpoints).join(', '));
        
        // Test 2: Get Available Networks
        console.log('\n📡 2. Testing Get Networks');
        console.log('-'.repeat(30));
        
        try {
            const networks = await vtuService.getAvailableNetworks();
            console.log('✅ Networks retrieved:', networks.length, 'networks');
            networks.forEach(network => {
                console.log(`   - ${network.name} (${network.code})`);
            });
        } catch (error) {
            console.log('❌ Networks test failed:', error.message);
        }
        
        // Test 3: Get Data Plans
        console.log('\n📊 3. Testing Get Data Plans');
        console.log('-'.repeat(30));
        
        try {
            const dataPlans = await vtuService.getDataPlans(TEST_CONFIG.testNetwork);
            console.log(`✅ Data plans retrieved for ${TEST_CONFIG.testNetwork}:`, dataPlans.length, 'plans');
            dataPlans.slice(0, 3).forEach(plan => {
                console.log(`   - ${plan.name}: ₦${plan.price}`);
            });
        } catch (error) {
            console.log('❌ Data plans test failed:', error.message);
        }
        
        // Test 4: Get Cable Providers
        console.log('\n📺 4. Testing Get Cable Providers');
        console.log('-'.repeat(30));
        
        try {
            const cableProviders = await vtuService.getCableProviders();
            console.log('✅ Cable providers retrieved:', cableProviders.length, 'providers');
            cableProviders.forEach(provider => {
                console.log(`   - ${provider.name} (${provider.code})`);
            });
        } catch (error) {
            console.log('❌ Cable providers test failed:', error.message);
        }
        
        // Test 5: Get Cable Packages
        console.log('\n📦 5. Testing Get Cable Packages');
        console.log('-'.repeat(30));
        
        try {
            const cablePackages = await vtuService.getCablePackages(TEST_CONFIG.cableProvider);
            console.log(`✅ Cable packages retrieved for ${TEST_CONFIG.cableProvider}:`, cablePackages.length, 'packages');
            cablePackages.slice(0, 3).forEach(pkg => {
                console.log(`   - ${pkg.name}: ₦${pkg.price}`);
            });
        } catch (error) {
            console.log('❌ Cable packages test failed:', error.message);
        }
        
        // Test 6: Get Electricity Providers
        console.log('\n⚡ 6. Testing Get Electricity Providers');
        console.log('-'.repeat(30));
        
        try {
            const electricityProviders = await vtuService.getElectricityProviders();
            console.log('✅ Electricity providers retrieved:', electricityProviders.length, 'providers');
            electricityProviders.slice(0, 5).forEach(provider => {
                console.log(`   - ${provider.name} (${provider.code})`);
            });
        } catch (error) {
            console.log('❌ Electricity providers test failed:', error.message);
        }
        
        // Test 7: Validate Smartcard (Mock)
        console.log('\n🔍 7. Testing Smartcard Validation');
        console.log('-'.repeat(30));
        
        try {
            const smartcardValidation = await vtuService.validateSmartcard({
                provider: TEST_CONFIG.cableProvider,
                smartcard_number: TEST_CONFIG.testSmartcard
            });
            
            if (smartcardValidation.valid) {
                console.log('✅ Smartcard validation successful');
                console.log(`   Customer: ${smartcardValidation.customer_name}`);
            } else {
                console.log('❌ Smartcard validation failed:', smartcardValidation.message);
            }
        } catch (error) {
            console.log('❌ Smartcard validation test failed:', error.message);
        }
        
        // Test 8: Validate Meter Number (Mock)
        console.log('\n🔍 8. Testing Meter Validation');
        console.log('-'.repeat(30));
        
        try {
            const meterValidation = await vtuService.validateMeterNumber({
                provider: TEST_CONFIG.electricityProvider,
                meter_number: TEST_CONFIG.testMeterNumber,
                meter_type: 'prepaid'
            });
            
            if (meterValidation.valid) {
                console.log('✅ Meter validation successful');
                console.log(`   Customer: ${meterValidation.customer_name}`);
                console.log(`   Type: ${meterValidation.account_type}`);
            } else {
                console.log('❌ Meter validation failed:', meterValidation.message);
            }
        } catch (error) {
            console.log('❌ Meter validation test failed:', error.message);
        }
        
        // Test 9: Check VTU Balance
        console.log('\n💰 9. Testing VTU Balance Check');
        console.log('-'.repeat(30));
        
        try {
            const balance = await vtuService.getBalance();
            
            if (balance.success) {
                console.log('✅ Balance check successful');
                console.log(`   Balance: ₦${balance.balance}`);
            } else {
                console.log('❌ Balance check failed:', balance.message);
            }
        } catch (error) {
            console.log('❌ Balance check test failed:', error.message);
        }
        
        // Test 10: Network ID Mapping
        console.log('\n🗺️  10. Testing Network ID Mapping');
        console.log('-'.repeat(30));
        
        const networks = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'];
        networks.forEach(network => {
            const networkId = clubkonnectConfig.getNetworkId(network);
            console.log(`   ${network}: ${networkId ? networkId : '❌ Not mapped'}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 Clubkonnect VTU Service Test Completed');
        console.log('\n📝 Notes:');
        console.log('   - Some tests use mock data for validation');
        console.log('   - Real transactions require valid Clubkonnect credentials');
        console.log('   - Update TEST_CONFIG with your test data');
        console.log('   - Ensure .env file has CLUBKONNECT_* variables set');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    testClubkonnectConnection()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testClubkonnectConnection,
    TEST_CONFIG
};
