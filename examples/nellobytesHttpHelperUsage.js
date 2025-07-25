const nellobytesHttpHelper = require('../utils/nellobytesHttpHelper');

/**
 * Usage examples for the Nellobytes HTTP Helper
 * Demonstrates various scenarios and best practices
 */

class NellobytesHttpHelperExamples {
    
    /**
     * Example 1: Basic GET request with simple parameters
     */
    async basicGetRequest() {
        console.log('\n📡 Example 1: Basic GET Request');
        
        try {
            const result = await nellobytesHttpHelper.get('networks', {
                format: 'json',
                active: true
            });

            if (result.success) {
                console.log('✅ Request successful');
                console.log('Response type:', result.type);
                console.log('Data:', result.data);
            } else {
                console.log('❌ Request failed');
                console.log('Error:', result.error);
            }
        } catch (error) {
            console.error('Exception:', error.message);
        }
    }

    /**
     * Example 2: Complex query string building
     */
    async complexQueryStringExample() {
        console.log('\n🔧 Example 2: Complex Query String Building');
        
        const complexParams = {
            network: 'mtn',
            amount: [100, 200, 500],
            filters: {
                status: 'active',
                type: 'data',
                region: 'nigeria'
            },
            options: {
                includePricing: true,
                includeDescription: false
            },
            sort: 'price',
            limit: 50
        };

        const queryString = nellobytesHttpHelper.buildQueryString(complexParams);
        console.log('Generated query string:', queryString);
        
        // Use it in a request
        const result = await nellobytesHttpHelper.get('data-plans', complexParams);
        console.log('Request result:', result.success ? '✅ Success' : '❌ Failed');
    }

    /**
     * Example 3: Working with different response types
     */
    async responseTypeHandling() {
        console.log('\n📊 Example 3: Response Type Handling');
        
        // JSON response
        const jsonResult = await nellobytesHttpHelper.getBalance();
        if (jsonResult.success) {
            console.log('JSON Response:');
            console.log('- Type:', jsonResult.type);
            console.log('- Data:', jsonResult.data);
        }

        // Simulate CSV response (would normally come from API)
        const csvData = 'id,network,price\n1,mtn,100\n2,airtel,95\n3,glo,90';
        const parsedCsv = nellobytesHttpHelper._parseCSV(csvData);
        console.log('\nCSV Parsing Example:');
        console.log('- Headers:', parsedCsv.headers);
        console.log('- Rows:', parsedCsv.rows);
        console.log('- Count:', parsedCsv.count);
    }

    /**
     * Example 4: Error handling and retry logic
     */
    async errorHandlingExample() {
        console.log('\n⚠️ Example 4: Error Handling');
        
        // Test with invalid endpoint to trigger error
        const result = await nellobytesHttpHelper.get('invalid-endpoint');
        
        if (!result.success) {
            console.log('Error Details:');
            console.log('- Name:', result.error.name);
            console.log('- Code:', result.error.code);
            console.log('- Type:', result.error.type);
            console.log('- Status:', result.error.status);
            console.log('- Message:', result.error.message);
            console.log('- Retryable:', result.error.retryable);
            console.log('- Details:', result.error.details);
            console.log('- Attempts:', result.meta.attempts);
        }
    }

    /**
     * Example 5: Using convenience methods
     */
    async convenienceMethodsExample() {
        console.log('\n🚀 Example 5: Convenience Methods');
        
        // Get networks
        const networks = await nellobytesHttpHelper.getNetworks();
        console.log('Networks result:', networks.success ? '✅ Success' : '❌ Failed');
        
        // Get data plans for specific network
        const dataPlans = await nellobytesHttpHelper.getDataPlans('mtn', {
            type: 'prepaid'
        });
        console.log('Data plans result:', dataPlans.success ? '✅ Success' : '❌ Failed');
        
        // Check balance
        const balance = await nellobytesHttpHelper.getBalance();
        console.log('Balance result:', balance.success ? '✅ Success' : '❌ Failed');
        
        // Check transaction status
        const status = await nellobytesHttpHelper.getTransactionStatus('TXN123456');
        console.log('Transaction status result:', status.success ? '✅ Success' : '❌ Failed');
    }

    /**
     * Example 6: Configuration and monitoring
     */
    async configurationExample() {
        console.log('\n⚙️ Example 6: Configuration & Monitoring');
        
        // Get configuration summary
        const config = nellobytesHttpHelper.getConfigSummary();
        console.log('Configuration:');
        Object.entries(config).forEach(([key, value]) => {
            console.log(`- ${key}:`, value);
        });

        // Test connection
        const connectionTest = await nellobytesHttpHelper.testConnection();
        console.log('\nConnection Test:');
        console.log('- Success:', connectionTest.success);
        console.log('- Message:', connectionTest.message);
        if (connectionTest.data) {
            console.log('- Data:', connectionTest.data);
        }
    }

    /**
     * Example 7: Integration with existing service patterns
     */
    async serviceIntegrationExample() {
        console.log('\n🔗 Example 7: Service Integration');
        
        // Example of how to use in a service method
        try {
            const result = await this.purchaseDataWithHelper('08012345678', 'mtn', '1GB');
            console.log('Purchase result:', result);
        } catch (error) {
            console.error('Purchase failed:', error.message);
        }
    }

    /**
     * Helper method showing how to integrate with business logic
     */
    async purchaseDataWithHelper(phone, network, plan) {
        // Validate inputs
        if (!phone || !network || !plan) {
            throw new Error('Missing required parameters');
        }

        // First, get available data plans
        const plansResult = await nellobytesHttpHelper.getDataPlans(network);
        if (!plansResult.success) {
            throw new Error(`Failed to get data plans: ${plansResult.error.message}`);
        }

        // Find the requested plan (simplified logic)
        const availablePlans = plansResult.data;
        console.log('Available plans:', availablePlans);

        // Check account balance
        const balanceResult = await nellobytesHttpHelper.getBalance();
        if (!balanceResult.success) {
            throw new Error(`Failed to check balance: ${balanceResult.error.message}`);
        }

        console.log('Account balance:', balanceResult.data);

        // In a real implementation, you would:
        // 1. Validate the plan exists and is available
        // 2. Check if balance is sufficient
        // 3. Make the purchase request (POST request - would need to extend helper for POST)
        // 4. Return transaction details

        return {
            success: true,
            message: 'Data purchase simulation completed',
            transactionId: 'TXN' + Date.now(),
            phone,
            network,
            plan
        };
    }

    /**
     * Run all examples
     */
    async runAllExamples() {
        console.log('🔧 Running Nellobytes HTTP Helper Usage Examples...\n');

        await this.basicGetRequest();
        await this.complexQueryStringExample();
        await this.responseTypeHandling();
        await this.errorHandlingExample();
        await this.convenienceMethodsExample();
        await this.configurationExample();
        await this.serviceIntegrationExample();

        console.log('\n✅ All examples completed!');
    }
}

// Export for use in other files
module.exports = NellobytesHttpHelperExamples;

// If run directly, execute examples
if (require.main === module) {
    const examples = new NellobytesHttpHelperExamples();
    examples.runAllExamples().catch(error => {
        console.error('❌ Examples failed:', error);
        process.exit(1);
    });
}
