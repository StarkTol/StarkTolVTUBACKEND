#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * This script validates the deployment configuration to prevent regressions.
 * Run this before deploying to catch common deployment issues early.
 * 
 * Usage: node scripts/validate-deployment.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Helper functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logSuccess = (message) => log(`✅ ${message}`, 'green');
const logError = (message) => log(`❌ ${message}`, 'red');
const logWarning = (message) => log(`⚠️  ${message}`, 'yellow');
const logInfo = (message) => log(`ℹ️  ${message}`, 'blue');

// Validation functions
const validatePortConfiguration = () => {
  logInfo('Validating port configuration...');
  
  const files = ['index.js', 'server.js', 'config/environment.js'];
  let allValid = true;
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for process.env.PORT usage
      if (content.includes('process.env.PORT')) {
        logSuccess(`${file}: Uses process.env.PORT`);
      } else {
        logError(`${file}: Missing process.env.PORT configuration`);
        allValid = false;
      }
      
      // Check for hardcoded ports (should only be fallback)
      const hardcodedPortRegex = /PORT\s*=\s*\d+(?![^}]*})/g;
      const matches = content.match(hardcodedPortRegex);
      if (matches && !content.includes('process.env.PORT')) {
        logWarning(`${file}: Contains hardcoded port without process.env.PORT fallback`);
      }
      
      // Check for 0.0.0.0 binding
      if (content.includes("'0.0.0.0'") || content.includes('"0.0.0.0"')) {
        logSuccess(`${file}: Properly binds to 0.0.0.0`);
      } else if (content.includes('.listen(')) {
        logWarning(`${file}: May not be binding to 0.0.0.0 (required for deployment)`);
      }
    }
  });
  
  return allValid;
};

const validateHealthEndpoints = () => {
  logInfo('Validating health endpoints...');
  
  const files = ['index.js', 'server.js'];
  const requiredEndpoints = ['/health', '/healthz', '/api/status'];
  let allValid = true;
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      requiredEndpoints.forEach(endpoint => {
        if (content.includes(`'${endpoint}'`) || content.includes(`"${endpoint}"`)) {
          logSuccess(`${file}: Contains ${endpoint} endpoint`);
        } else {
          logError(`${file}: Missing ${endpoint} endpoint`);
          allValid = false;
        }
      });
    }
  });
  
  return allValid;
};

const validateEnvironmentConfiguration = () => {
  logInfo('Validating environment configuration...');
  
  let allValid = true;
  
  // Check .env.example exists
  if (fs.existsSync('.env.example')) {
    logSuccess('.env.example file exists');
    
    // Check for consistent PORT configuration
    const envExample = fs.readFileSync('.env.example', 'utf8');
    if (envExample.includes('PORT=3000')) {
      logSuccess('.env.example uses PORT=3000 (consistent with server)');
    } else if (envExample.includes('PORT=8000')) {
      logError('.env.example uses PORT=8000 (inconsistent with server fallback)');
      allValid = false;
    }
  } else {
    logError('.env.example file missing');
    allValid = false;
  }
  
  // Check .env is not committed
  if (fs.existsSync('.env')) {
    logError('.env file should not be committed to repository');
    allValid = false;
  } else {
    logSuccess('.env file not in repository (good!)');
  }
  
  // Check for required environment variables documentation
  const requiredVars = [
    'NODE_ENV',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  if (fs.existsSync('.env.example')) {
    const envContent = fs.readFileSync('.env.example', 'utf8');
    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        logSuccess(`Required variable ${varName} documented in .env.example`);
      } else {
        logError(`Required variable ${varName} missing from .env.example`);
        allValid = false;
      }
    });
  }
  
  return allValid;
};

const validateDocumentation = () => {
  logInfo('Validating deployment documentation...');
  
  const requiredDocs = [
    'README.md',
    'HEALTH_ENDPOINTS.md',
    'RENDER_TROUBLESHOOTING.md',
    'ROOT_CAUSE_ANALYSIS.md'
  ];
  
  let allValid = true;
  
  requiredDocs.forEach(doc => {
    if (fs.existsSync(doc)) {
      logSuccess(`${doc} exists`);
    } else {
      logWarning(`${doc} missing (recommended for deployment)`);
    }
  });
  
  return allValid;
};

const validatePackageJson = () => {
  logInfo('Validating package.json configuration...');
  
  let allValid = true;
  
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check scripts
    const requiredScripts = ['start', 'start:minimal'];
    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        logSuccess(`package.json contains "${script}" script`);
      } else {
        logError(`package.json missing "${script}" script`);
        allValid = false;
      }
    });
    
    // Check main entry point
    if (packageJson.main === 'index.js') {
      logSuccess('package.json main entry point is index.js');
    } else {
      logWarning(`package.json main entry point is ${packageJson.main} (should be index.js)`);
    }
  } else {
    logError('package.json missing');
    allValid = false;
  }
  
  return allValid;
};

// Main validation function
const runValidation = () => {
  log('\n🔍 StarkTol Deployment Validation\n', 'bold');
  
  const validations = [
    { name: 'Port Configuration', fn: validatePortConfiguration },
    { name: 'Health Endpoints', fn: validateHealthEndpoints },
    { name: 'Environment Configuration', fn: validateEnvironmentConfiguration },
    { name: 'Documentation', fn: validateDocumentation },
    { name: 'Package Configuration', fn: validatePackageJson }
  ];
  
  let allPassed = true;
  const results = [];
  
  validations.forEach(validation => {
    log(`\n--- ${validation.name} ---`, 'bold');
    const passed = validation.fn();
    results.push({ name: validation.name, passed });
    if (!passed) allPassed = false;
  });
  
  // Summary
  log('\n📊 Validation Summary', 'bold');
  log('='.repeat(50));
  
  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}: PASSED`);
    } else {
      logError(`${result.name}: FAILED`);
    }
  });
  
  log('='.repeat(50));
  
  if (allPassed) {
    logSuccess('🎉 All validations passed! Ready for deployment.');
    process.exit(0);
  } else {
    logError('🚨 Some validations failed. Please fix the issues before deploying.');
    log('\n💡 Tip: Check ROOT_CAUSE_ANALYSIS.md for common issues and solutions.', 'yellow');
    process.exit(1);
  }
};

// Run validation if called directly
if (require.main === module) {
  runValidation();
}

module.exports = {
  runValidation,
  validatePortConfiguration,
  validateHealthEndpoints,
  validateEnvironmentConfiguration,
  validateDocumentation,
  validatePackageJson
};
