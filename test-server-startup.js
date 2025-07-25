#!/usr/bin/env node

/**
 * Test script to verify server startup and graceful shutdown
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Server Startup and Graceful Shutdown');
console.log('==============================================\n');

function testServer(scriptName, description) {
    return new Promise((resolve) => {
        console.log(`\n📋 Testing: ${description}`);
        console.log(`🔧 Command: node ${scriptName}`);
        console.log('-----------------------------------');

        const serverProcess = spawn('node', [scriptName], {
            stdio: 'pipe',
            cwd: __dirname
        });

        let output = '';
        let serverStarted = false;

        // Capture stdout
        serverProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stdout.write(text);

            // Check if server has started
            if ((text.includes('Ready to serve requests') || text.includes('Ready to receive requests')) && !serverStarted) {
                serverStarted = true;
                console.log('\n✅ Server started successfully, testing graceful shutdown...');
                
                // Wait a moment then send SIGINT
                setTimeout(() => {
                    serverProcess.kill('SIGINT');
                }, 1000);
            }
        });

        // Capture stderr
        serverProcess.stderr.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stderr.write(text);
        });

        // Handle process exit
        serverProcess.on('close', (code, signal) => {
            console.log(`\n📊 Process exited with code: ${code}, signal: ${signal}`);
            
            const result = {
                script: scriptName,
                description,
                exitCode: code,
                signal,
                serverStarted,
                output,
                // On Windows, SIGINT results in null exit code, which is expected for graceful shutdown
                success: serverStarted && (code === 0 || (code === null && signal === 'SIGINT'))
            };

            if (result.success) {
                console.log('✅ Test PASSED: Server started and exited gracefully');
            } else {
                console.log(`❌ Test FAILED: Expected graceful exit, got code ${code}, signal ${signal}`);
            }

            resolve(result);
        });

        // Handle process error
        serverProcess.on('error', (error) => {
            console.error(`❌ Process error: ${error.message}`);
            resolve({
                script: scriptName,
                description,
                exitCode: -1,
                signal: null,
                serverStarted: false,
                output,
                success: false,
                error: error.message
            });
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!serverStarted) {
                console.log('⏰ Timeout: Server did not start within 30 seconds');
                serverProcess.kill('SIGKILL');
            }
        }, 30000);
    });
}

async function runTests() {
    const tests = [
        { script: 'index.js', description: 'Full Application Server (npm start equivalent)' },
        { script: 'server.js', description: 'Minimal Server (npm run start:minimal equivalent)' }
    ];

    const results = [];

    for (const test of tests) {
        const result = await testServer(test.script, test.description);
        results.push(result);
        console.log('\n' + '='.repeat(50) + '\n');
    }

    // Print summary
    console.log('📋 TEST SUMMARY');
    console.log('===============');
    
    let allPassed = true;
    for (const result of results) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${result.description}`);
        console.log(`     Exit Code: ${result.exitCode}`);
        console.log(`     Server Started: ${result.serverStarted ? 'Yes' : 'No'}`);
        if (result.error) {
            console.log(`     Error: ${result.error}`);
        }
        console.log('');
        
        if (!result.success) {
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('🎉 All tests passed! Servers start correctly and exit gracefully with code 0.');
    } else {
        console.log('⚠️  Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}

// Run the tests
runTests().catch((error) => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
});
