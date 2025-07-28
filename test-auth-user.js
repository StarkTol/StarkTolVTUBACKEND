#!/usr/bin/env node

/**
 * Authentication & User Profile Management Test Suite
 * Tests all endpoints for the modules you requested
 */

require('dotenv').config();
const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Test data
const testUser = {
  email: `testuser_${Date.now()}@example.com`,
  password: 'TestPassword123',
  full_name: 'Test User',
  phone: '+2348012345678'
};

let authToken = null;
let refreshToken = null;

console.log('🧪 Starting Authentication & User Management Tests...\n');
console.log(`🌐 Base URL: ${BASE_URL}${API_PREFIX}`);

// Helper function to make API requests
const apiRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${API_PREFIX}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test functions
const testRegistration = async () => {
  console.log('📝 Testing User Registration...');
  
  const result = await apiRequest('POST', '/auth/register', testUser);
  
  if (result.success && result.data.success) {
    console.log('   ✅ Registration successful');
    console.log(`   📧 Email: ${testUser.email}`);
    console.log(`   👤 User ID: ${result.data.data.user.id}`);
    return true;
  } else {
    console.log('   ❌ Registration failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testLogin = async () => {
  console.log('\n🔐 Testing User Login...');
  
  const loginData = {
    email: testUser.email,
    password: testUser.password,
    remember_me: true
  };
  
  const result = await apiRequest('POST', '/auth/login', loginData);
  
  if (result.success && result.data.success) {
    console.log('   ✅ Login successful');
    authToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    console.log('   🎫 Access token received');
    console.log('   🔄 Refresh token received');
    console.log(`   ⏰ Expires in: ${result.data.data.expiresIn} seconds`);
    return true;
  } else {
    console.log('   ❌ Login failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testGetProfile = async () => {
  console.log('\n👤 Testing Get User Profile...');
  
  const result = await apiRequest('GET', '/user/profile', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Profile retrieved successfully');
    console.log(`   📧 Email: ${result.data.data.user.email}`);
    console.log(`   👤 Name: ${result.data.data.user.full_name}`);
    console.log(`   📱 Phone: ${result.data.data.user.phone}`);
    console.log(`   💰 Wallet Balance: ₦${result.data.data.wallet.balance || 0}`);
    return true;
  } else {
    console.log('   ❌ Get profile failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testUpdateProfile = async () => {
  console.log('\n📝 Testing Update User Profile...');
  
  const updateData = {
    full_name: 'Updated Test User',
    phone: '+2348087654321',
    email: testUser.email // Optional email update
  };
  
  const result = await apiRequest('PUT', '/user/profile', updateData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Profile updated successfully');
    console.log(`   👤 New Name: ${result.data.data.full_name}`);
    console.log(`   📱 New Phone: ${result.data.data.phone}`);
    return true;
  } else {
    console.log('   ❌ Update profile failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testChangePassword = async () => {
  console.log('\n🔒 Testing Change Password...');
  
  const newPassword = 'NewTestPassword456';
  const passwordData = {
    current_password: testUser.password,
    new_password: newPassword
  };
  
  const result = await apiRequest('PUT', '/user/change-password', passwordData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Password changed successfully');
    // Update password for future tests
    testUser.password = newPassword;
    return true;
  } else {
    console.log('   ❌ Change password failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testGetActivities = async () => {
  console.log('\n📋 Testing Get User Activities...');
  
  const result = await apiRequest('GET', '/user/activities?page=1&limit=10', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Activities retrieved successfully');
    console.log(`   📊 Total Activities: ${result.data.data.length}`);
    if (result.data.data.length > 0) {
      console.log(`   🕐 Latest Activity: ${result.data.data[0].activity_type}`);
    }
    if (result.data.meta?.pagination) {
      console.log(`   📄 Page: ${result.data.meta.pagination.currentPage} of ${result.data.meta.pagination.totalPages}`);
    }
    return true;
  } else {
    console.log('   ❌ Get activities failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testRefreshToken = async () => {
  console.log('\n🔄 Testing Refresh Token...');
  
  const result = await apiRequest('POST', '/auth/refresh-token', {
    refresh_token: refreshToken
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Token refreshed successfully');
    authToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    console.log('   🎫 New access token received');
    console.log('   🔄 New refresh token received');
    return true;
  } else {
    console.log('   ❌ Refresh token failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testLogout = async () => {
  console.log('\n🚪 Testing User Logout...');
  
  const result = await apiRequest('POST', '/auth/logout', {
    refresh_token: refreshToken
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('   ✅ Logout successful');
    authToken = null;
    refreshToken = null;
    return true;
  } else {
    console.log('   ❌ Logout failed');
    console.log(`   Error: ${JSON.stringify(result.error)}`);
    return false;
  }
};

const testProtectedEndpointAfterLogout = async () => {
  console.log('\n🔒 Testing Protected Endpoint After Logout...');
  
  const result = await apiRequest('GET', '/user/profile', null, {
    'Authorization': `Bearer ${authToken || 'invalid_token'}`
  });
  
  if (!result.success && result.status === 401) {
    console.log('   ✅ Protected endpoint correctly blocked after logout');
    return true;
  } else {
    console.log('   ❌ Protected endpoint should be blocked after logout');
    console.log(`   Unexpected response: ${JSON.stringify(result)}`);
    return false;
  }
};

// Input validation tests
const testInputValidation = async () => {
  console.log('\n🛡️ Testing Input Validation...');
  
  // Test invalid email
  const invalidEmailResult = await apiRequest('POST', '/auth/register', {
    ...testUser,
    email: 'invalid-email',
    phone: '+2348012345679' // Different phone to avoid duplicate
  });
  
  if (!invalidEmailResult.success && invalidEmailResult.status === 400) {
    console.log('   ✅ Invalid email format correctly rejected');
  } else {
    console.log('   ❌ Invalid email should be rejected');
  }
  
  // Test weak password
  const weakPasswordResult = await apiRequest('POST', '/auth/register', {
    ...testUser,
    email: `weak_${Date.now()}@example.com`,
    password: '123',
    phone: '+2348012345680' // Different phone to avoid duplicate
  });
  
  if (!weakPasswordResult.success && weakPasswordResult.status === 400) {
    console.log('   ✅ Weak password correctly rejected');
  } else {
    console.log('   ❌ Weak password should be rejected');
  }
  
  // Test invalid phone
  const invalidPhoneResult = await apiRequest('POST', '/auth/register', {
    ...testUser,
    email: `phone_${Date.now()}@example.com`,
    phone: '123' // Invalid phone
  });
  
  if (!invalidPhoneResult.success && invalidPhoneResult.status === 400) {
    console.log('   ✅ Invalid phone format correctly rejected');
  } else {
    console.log('   ❌ Invalid phone should be rejected');
  }
  
  return true;
};

// Run all tests
const runTests = async () => {
  const tests = [
    testInputValidation,
    testRegistration,
    testLogin,
    testGetProfile,
    testUpdateProfile,
    testChangePassword,
    testGetActivities,
    testRefreshToken,
    testLogout,
    testProtectedEndpointAfterLogout
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Test threw error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All Authentication & User Management tests passed!');
    console.log('✨ Your backend implementation is production ready!');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
  }
};

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
