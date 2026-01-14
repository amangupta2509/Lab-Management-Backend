const mysql = require("mysql2");
require("dotenv").config();

// Create connection pool with production settings
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Connection timeout
  connectTimeout: 60000,
  timezone: "+00:00",
  // Character set
  charset: "utf8mb4",
  // SSL configuration for production
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : false,
});

// Promisify for async/await
const promisePool = pool.promise();

// Test connection with retry logic
const testConnection = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await promisePool.getConnection();
      console.log(" Database connected successfully!");

      // Test query
      await connection.query("SELECT 1");
      connection.release();

      return true;
    } catch (error) {
      console.error(
        `❌ Database connection attempt ${i + 1}/${retries} failed:`,
        error.message
      );

      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(" Database connection failed after all retries");
        if (process.env.NODE_ENV === "production") {
          process.exit(1);
        }
      }
    }
  }
  return false;
};

// Initialize connection test
testConnection();

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.log("Connection lost. Will retry on next query.");
    // Don't auto-reconnect here - let the pool handle it
  } else if (err.code === "ECONNRESET") {
    console.log("Connection reset. Pool will handle reconnection.");
  } else {
    console.error("Critical database error:", err.code);
  }
});

// Graceful pool closure
const closePool = async () => {
  try {
    await promisePool.end();
    console.log("Database pool closed");
  } catch (error) {
    console.error("Error closing database pool:", error);
    throw error;
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const connection = await promisePool.getConnection();
    await connection.query("SELECT 1");
    connection.release();
    return { healthy: true, message: "Database connection is healthy" };
  } catch (error) {
    return { healthy: false, message: error.message };
  }
};

module.exports = promisePool;
module.exports.closePool = closePool;
module.exports.healthCheck = healthCheck;
