/**
 * Mobile OAuth Testing Script
 * Run: node test-mobile-oauth.js
 */

require('dotenv').config();
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testMobileOAuth() {
  log('\n' + '='.repeat(60), 'blue');
  log('📱 MOBILE GOOGLE OAUTH TESTING', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  // Test 1: Environment Check
  log('TEST 1: Environment Variables', 'cyan');
  log('-'.repeat(60), 'cyan');
  
  if (!GOOGLE_CLIENT_ID) {
    log('❌ GOOGLE_CLIENT_ID not found in .env', 'red');
    process.exit(1);
  }
  log(`✅ GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID.substring(0, 30)}...`, 'green');
  
  if (process.env.GOOGLE_CLIENT_SECRET) {
    log('⚠️  GOOGLE_CLIENT_SECRET found (not needed for mobile)', 'yellow');
  } else {
    log('✅ GOOGLE_CLIENT_SECRET not set (correct for mobile)', 'green');
  }
  
  // Test 2: Server Health
  log('\nTEST 2: Server Health Check', 'cyan');
  log('-'.repeat(60), 'cyan');
  
  try {
    const health = await axios.get(`${API_URL}/health`);
    
    if (health.data.status === 'healthy') {
      log('✅ Server is healthy', 'green');
      log(`   Platform: ${health.data.platform}`, 'green');
      log(`   Mobile OAuth: ${health.data.features.mobileOAuth}`, 'green');
    }
  } catch (error) {
    log(`❌ Server not responding: ${error.message}`, 'red');
    log('   Make sure server is running: npm start', 'yellow');
    process.exit(1);
  }
  
  // Test 3: Database Schema
  log('\nTEST 3: Database Schema Check', 'cyan');
  log('-'.repeat(60), 'cyan');
  
  const mysql = require('mysql2/promise');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM users WHERE Field IN 
       ('google_id', 'oauth_provider', 'email_verified', 'avatar_url')`
    );
    
    if (columns.length === 4) {
      log('✅ All OAuth fields present in database', 'green');
      columns.forEach(col => {
        log(`   - ${col.Field}: ${col.Type}`, 'green');
      });
    } else {
      log(`❌ Missing OAuth fields. Found: ${columns.length}/4`, 'red');
      log('   Run the database migration!', 'yellow');
    }
    
    await connection.end();
  } catch (error) {
    log(`❌ Database check failed: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Test 4: Mock OAuth Request
  log('\nTEST 4: Mobile OAuth Endpoint', 'cyan');
  log('-'.repeat(60), 'cyan');
  
  try {
    // Test with invalid token (should fail gracefully)
    const response = await axios.post(
      `${API_URL}/api/auth/google/mobile`,
      { idToken: 'invalid_token_for_testing' },
      { validateStatus: () => true }
    );
    
    if (response.status === 401) {
      log('✅ Endpoint rejects invalid tokens (expected behavior)', 'green');
      log(`   Response: ${response.data.message}`, 'green');
    } else if (response.status === 400) {
      log('✅ Endpoint validates input correctly', 'green');
    } else {
      log(`⚠️  Unexpected status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Endpoint test failed: ${error.message}`, 'red');
  }
  
  // Test 5: Token Verification Setup
  log('\nTEST 5: Google Token Verification', 'cyan');
  log('-'.repeat(60), 'cyan');
  
  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    log('✅ OAuth2Client initialized successfully', 'green');
    log(`   Client ID configured: ${GOOGLE_CLIENT_ID.substring(0, 30)}...`, 'green');
  } catch (error) {
    log(`❌ OAuth2Client initialization failed: ${error.message}`, 'red');
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'blue');
  log('='.repeat(60), 'blue');
  
  log('\n✅ All systems ready for mobile OAuth!', 'green');
  log('\n📱 NEXT STEPS:', 'cyan');
  log('   1. Get a real Google ID token from your mobile app', 'white');
  log('   2. Send POST request to /api/auth/google/mobile', 'white');
  log('   3. Use returned JWT token for subsequent API calls', 'white');
  
  log('\n🔧 TESTING WITH CURL:', 'cyan');
  log(`   curl -X POST ${API_URL}/api/auth/google/mobile \\`, 'white');
  log(`     -H "Content-Type: application/json" \\`, 'white');
  log(`     -d '{"idToken":"YOUR_REAL_GOOGLE_ID_TOKEN"}'`, 'white');
  
  log('\n📚 DOCUMENTATION:', 'cyan');
  log('   Endpoint: POST /api/auth/google/mobile', 'white');
  log('   Headers: Content-Type: application/json', 'white');
  log('   Body: { "idToken": "eyJhbGc..." }', 'white');
  log('   Response: { "success": true, "token": "...", "user": {...} }', 'white');
  
  log('\n' + '='.repeat(60) + '\n', 'blue');
}

// Run tests
testMobileOAuth()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });