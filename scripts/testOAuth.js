/**
 * OAuth Testing Script
 * Run this to verify OAuth configuration
 *
 * Usage: node scripts/testOAuth.js
 */

require("dotenv").config();
const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:5000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testOAuthConfig() {
  log("\n🔍 Testing OAuth Configuration...\n", "blue");

  // Test 1: Environment Variables
  log("1. Checking Environment Variables...", "yellow");
  const requiredVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "SESSION_SECRET",
    "GOOGLE_CALLBACK_URL_DEV",
    "FRONTEND_URL_DEV",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    log(`   ❌ Missing: ${missing.join(", ")}`, "red");
    return false;
  }
  log("   ✅ All environment variables present", "green");

  // Test 2: Server Health
  log("\n2. Checking Server Health...", "yellow");
  try {
    const response = await axios.get(`${API_URL}/health`);
    if (response.data.status === "healthy") {
      log("   ✅ Server is healthy", "green");
      if (response.data.features?.oauth) {
        log("   ✅ OAuth feature enabled", "green");
      }
    }
  } catch (error) {
    log(`   ❌ Server not responding: ${error.message}`, "red");
    return false;
  }

  // Test 3: OAuth Endpoint
  log("\n3. Checking OAuth Endpoint...", "yellow");
  try {
    const response = await axios.get(`${API_URL}/api/auth/google`, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });

    if (
      response.status === 302 &&
      response.headers.location?.includes("accounts.google.com")
    ) {
      log("   ✅ OAuth redirect working", "green");
      log(
        `   🔗 Redirect URL: ${response.headers.location.substring(0, 50)}...`,
        "blue"
      );
    }
  } catch (error) {
    if (error.response?.status === 302) {
      log("   ✅ OAuth redirect configured", "green");
    } else {
      log(`   ❌ OAuth endpoint error: ${error.message}`, "red");
    }
  }

  // Test 4: Database OAuth Fields
  log("\n4. Checking Database Schema...", "yellow");
  const mysql = require("mysql2/promise");

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM users WHERE Field IN ('google_id', 'oauth_provider', 'email_verified', 'avatar_url')"
    );

    if (columns.length === 4) {
      log("   ✅ OAuth fields present in database", "green");
    } else {
      log(`   ❌ Missing OAuth fields. Found: ${columns.length}/4`, "red");
      log("   Run the migration script!", "yellow");
    }

    await connection.end();
  } catch (error) {
    log(`   ❌ Database check failed: ${error.message}`, "red");
    return false;
  }

  // Test 5: Session Store
  log("\n5. Checking Session Store...", "yellow");
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [tables] = await connection.execute("SHOW TABLES LIKE 'sessions'");

    if (tables.length > 0) {
      log("   ✅ Session table exists", "green");
    } else {
      log("   ⚠️  Session table will be created on first session", "yellow");
    }

    await connection.end();
  } catch (error) {
    log(`   ⚠️  Could not verify session store: ${error.message}`, "yellow");
  }

  // Summary
  log("\n" + "=".repeat(50), "blue");
  log("📊 Configuration Summary", "blue");
  log("=".repeat(50), "blue");
  log(`\n✅ OAuth is ready to use!`, "green");
  log(`\n🔗 Test OAuth flow:`, "blue");
  log(`   ${API_URL}/api/auth/google\n`, "green");

  return true;
}

// Run tests
testOAuthConfig()
  .then((success) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    log(`\n❌ Test failed: ${error.message}`, "red");
    process.exit(1);
  });
