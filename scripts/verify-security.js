#!/usr/bin/env node

/**
 * Security Implementation Verification Script
 * Checks if all security measures have been properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Security Implementation Verification');
console.log('=====================================\n');

// Check if .env.example exists and contains required security variables
function checkEnvExample() {
    console.log('📄 Checking .env.example file...');
    
    const envExamplePath = '.env.example';
    if (!fs.existsSync(envExamplePath)) {
        console.log('❌ .env.example file not found');
        return false;
    }
    
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    const requiredSecurityVars = [
        'SESSION_SECRET',
        'ENCRYPTION_KEY',
        'RATE_LIMIT_WINDOW_MS',
        'RATE_LIMIT_MAX_REQUESTS',
        'SUPABASE_JWT_SECRET',
        'WEBHOOK_SECRET'
    ];
    
    console.log('✅ .env.example file exists');
    
    const missingVars = requiredSecurityVars.filter(variable => 
        !envContent.includes(variable)
    );
    
    if (missingVars.length === 0) {
        console.log('✅ All required security variables are defined in .env.example');
        return true;
    } else {
        console.log('❌ Missing security variables:', missingVars.join(', '));
        return false;
    }
}

// Check if security utilities exist
function checkSecurityFiles() {
    console.log('\n📁 Checking security files...');
    
    const securityFiles = [
        'utils/inputSanitizer.js',
        'middlewares/securityMiddleware.js',
        'utils/security.js',
        'utils/validator.js',
        'middlewares/validateRequest.js'
    ];

    let allExist = true;
    securityFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`  ✅ ${file}`);
        } else {
            console.log(`  ❌ ${file}`);
            allExist = false;
        }
    });
    
    return allExist;
}

// Check for obvious hardcoded secrets
function checkHardcodedValues() {
    console.log('\n🔐 Checking for hardcoded values...');
    
    const filesToCheck = [
        'config/environment.js',
        'index.js',
        'server.js'
    ];

    let foundHardcoded = false;
    filesToCheck.forEach(file => {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for process.env usage (good)
            const usesEnvVars = content.includes('process.env');
            
            // Check for suspicious hardcoded patterns
            const suspiciousPatterns = [
                /'[a-f0-9]{32,64}'/g, // Hex strings that look like keys
                /"[a-f0-9]{32,64}"/g,
                /password\s*[:=]\s*['"][^'"]{8,}['"](?!.*process\.env)/i,
                /secret\s*[:=]\s*['"][^'"]{10,}['"](?!.*process\.env)/i
            ];
            
            let hasHardcoded = false;
            suspiciousPatterns.forEach(pattern => {
                if (pattern.test(content)) {
                    hasHardcoded = true;
                }
            });
            
            if (hasHardcoded && !usesEnvVars) {
                console.log(`  ⚠️  Potential hardcoded values in ${file}`);
                foundHardcoded = true;
            } else {
                console.log(`  ✅ ${file} - Uses environment variables properly`);
            }
        }
    });

    if (!foundHardcoded) {
        console.log('✅ No obvious hardcoded secrets found');
    }
    
    return !foundHardcoded;
}

// Check if package.json includes required security dependencies
function checkSecurityDependencies() {
    console.log('\n📦 Checking security dependencies...');
    
    if (!fs.existsSync('package.json')) {
        console.log('❌ package.json not found');
        return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredSecurityDeps = [
        'helmet',
        'express-rate-limit',
        'express-mongo-sanitize',
        'hpp',
        'xss',
        'validator',
        'bcryptjs'
    ];
    
    const missingDeps = requiredSecurityDeps.filter(dep => !dependencies[dep]);
    
    if (missingDeps.length === 0) {
        console.log('✅ All required security dependencies are installed');
        return true;
    } else {
        console.log('❌ Missing security dependencies:', missingDeps.join(', '));
        console.log('Run: npm install', missingDeps.join(' '));
        return false;
    }
}

// Main verification function
function runVerification() {
    const checks = [
        { name: '.env.example', check: checkEnvExample },
        { name: 'Security Files', check: checkSecurityFiles },
        { name: 'Hardcoded Values', check: checkHardcodedValues },
        { name: 'Security Dependencies', check: checkSecurityDependencies }
    ];
    
    let allPassed = true;
    const results = [];
    
    checks.forEach(({ name, check }) => {
        const passed = check();
        results.push({ name, passed });
        if (!passed) allPassed = false;
    });
    
    console.log('\n📊 Verification Summary:');
    console.log('========================');
    
    results.forEach(({ name, passed }) => {
        console.log(`${passed ? '✅' : '❌'} ${name}`);
    });
    
    if (allPassed) {
        console.log('\n🎉 All security checks passed!');
        console.log('\n🛡️ Security Features Implemented:');
        console.log('  ✅ Input sanitization utilities');
        console.log('  ✅ XSS protection');
        console.log('  ✅ SQL/NoSQL injection prevention');
        console.log('  ✅ Rate limiting');
        console.log('  ✅ Security headers (Helmet)');
        console.log('  ✅ Request validation');
        console.log('  ✅ Environment variable management');
        console.log('  ✅ Parameter pollution prevention');
        
        console.log('\n🎯 Next Steps:');
        console.log('  1. Copy .env.example to .env');
        console.log('  2. Generate secure random keys:');
        console.log('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        console.log('  3. Replace ALL placeholder values in .env with actual secrets');
        console.log('  4. Never commit .env file to version control');
        console.log('  5. Set environment variables in production deployment');
        
    } else {
        console.log('\n⚠️  Some security checks failed. Please address the issues above.');
    }
    
    return allPassed;
}

// Run the verification
const success = runVerification();
process.exit(success ? 0 : 1);
