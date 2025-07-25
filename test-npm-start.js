#!/usr/bin/env node

/**
 * Test script to verify npm start works correctly
 */

const { spawn } = require('child_process');

console.log('🧪 Testing npm start command');
console.log('=============================\n');

function testNpmStart() {
    return new Promise((resolve) => {
        console.log('📋 Testing: npm start');
        console.log('🔧 Command: npm start');
        console.log('-----------------------------------');

        const npmProcess = spawn('npm', ['start'], {
            stdio: 'pipe',
            shell: true,
            cwd: __dirname
        });

        let output = '';
        let serverStarted = false;

        // Capture stdout
        npmProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stdout.write(text);

            // Check if server has started
            if (text.includes('Ready to serve requests') && !serverStarted) {
                serverStarted = true;
                console.log('\n✅ Server started successfully via npm start, testing graceful shutdown...');
                
                // Wait a moment then send SIGINT
                setTimeout(() => {
                    npmProcess.kill('SIGINT');
                }, 2000);
            }
        });

        // Capture stderr
        npmProcess.stderr.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stderr.write(text);
        });

        // Handle process exit
        npmProcess.on('close', (code, signal) => {
            console.log(`\n📊 npm start exited with code: ${code}, signal: ${signal}`);
            
            const result = {
                exitCode: code,
                signal,
                serverStarted,
                output,
                // On Windows, SIGINT results in null exit code, which is expected for graceful shutdown
                success: serverStarted && (code === 0 || code === null)
            };

            if (result.success) {
                console.log('✅ npm start test PASSED: Server started and exited gracefully');
            } else {
                console.log(`❌ npm start test FAILED: Expected graceful exit, got code ${code}, signal ${signal}`);
            }

            resolve(result);
        });

        // Handle process error
        npmProcess.on('error', (error) => {
            console.error(`❌ npm start process error: ${error.message}`);
            resolve({
                exitCode: -1,
                signal: null,
                serverStarted: false,
                output,
                success: false,
                error: error.message
            });
        });

        // Timeout after 45 seconds (npm can be slower to start)
        setTimeout(() => {
            if (!serverStarted) {
                console.log('⏰ Timeout: npm start did not complete within 45 seconds');
                npmProcess.kill('SIGKILL');
            }
        }, 45000);
    });
}

async function runTest() {
    const result = await testNpmStart();
    
    console.log('\n📋 NPM START TEST SUMMARY');
    console.log('=========================');
    
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - npm start command`);
    console.log(`     Exit Code: ${result.exitCode}`);
    console.log(`     Server Started: ${result.serverStarted ? 'Yes' : 'No'}`);
    if (result.error) {
        console.log(`     Error: ${result.error}`);
    }
    
    if (result.success) {
        console.log('\n🎉 npm start works correctly! Server starts and can be shut down gracefully.');
    } else {
        console.log('\n⚠️ npm start test failed. Check the output above for details.');
        process.exit(1);
    }
}

// Run the test
runTest().catch((error) => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
});
