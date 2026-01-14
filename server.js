const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const compression = require("compression");
require("dotenv").config();

// Import security middleware
const {
  securityHeaders,
  preventPollution,
  corsOptions,
  requestLogger,
  sanitizeError,
  apiLimiter,
  mobileClientInfo,
  sanitizeInput,
} = require("./middleware/security");

// Import and validate Google OAuth config
const { validateGoogleConfig } = require("./config/googleAuth");
const CONSTANTS = require("./config/constants");

const app = express();

// Trust proxy (required for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Disable x-powered-by header
app.disable("x-powered-by");

// ========================================
// SECURITY & MIDDLEWARE
// ========================================

// Security headers (simplified for mobile)
app.use(securityHeaders);

// CORS (React Native optimized)
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parser
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Input sanitization
app.use(sanitizeInput);

// Prevent parameter pollution
app.use(preventPollution);

// Mobile client detection
app.use(mobileClientInfo);

// Request logging (development only)
if (process.env.NODE_ENV === "development") {
  app.use(requestLogger);
}

// Serve static files (images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========================================
// HEALTH CHECK & INFO ENDPOINTS
// ========================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "2.0.0",
    platform: "react-native-expo",
    features: {
      googleOAuth: true,
      emailPasswordAuth: true,
      passwordReset: true,
      fileUpload: true,
    },
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "🔬 Lab Management System API",
    version: "2.0.0",
    platform: "React Native Expo",
    status: "running",
    authentication: {
      googleMobile: "POST /api/auth/google/mobile",
      emailPassword: "POST /api/auth/login",
      register: "POST /api/auth/register",
    },
    endpoints: {
      auth: "/api/auth",
      user: "/api/user",
      equipment: "/api/equipment",
      bookings: "/api/bookings",
      usage: "/api/usage",
      activity: "/api/activity",
      inventory: "/api/inventory",
      admin: "/api/admin",
    },

    documentation: {
      mobileAuth:
        "Send idToken from @react-native-google-signin to /api/auth/google/mobile",
      headers: {
        required: ["Authorization: Bearer <token>"],
        optional: [
          "X-Client-Type: mobile",
          "X-Platform: ios|android",
          "X-App-Version: 1.0.0",
        ],
      },
    },
  });
});

// ========================================
// IMPORT ROUTES
// ========================================

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const equipmentRoutes = require("./routes/equipment.routes");
const bookingRoutes = require("./routes/booking.routes");
const activityRoutes = require("./routes/activity.routes");
const usageRoutes = require("./routes/usage.routes");
const adminRoutes = require("./routes/admin.routes");
const inventoryRoutes = require("./routes/inventory.routes");

// ========================================
// APPLY RATE LIMITING
// ========================================

// Apply general rate limiting to all API routes
if (process.env.NODE_ENV === "production") {
  app.use("/api/", apiLimiter);
}

// ========================================
// REGISTER ROUTES
// ========================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/inventory", inventoryRoutes);

// ========================================
// ERROR HANDLERS
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    availableRoutes: [
      "/api/auth",
      "/api/user",
      "/api/equipment",
      "/api/bookings",
      "/api/usage",
      "/api/activity",
      "/api/inventory",
      "/api/admin",
    ],
  });
});

// Global error handler
app.use(sanitizeError);

// ========================================
// ENVIRONMENT VALIDATION
// ========================================

const requiredEnvVars = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
];

// Optional but recommended
const recommendedEnvVars = [
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "FRONTEND_URL_PROD",
];

const missingRequired = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);
const missingRecommended = recommendedEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingRequired.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingRequired.join(", ")
  );
  process.exit(1);
}

if (missingRecommended.length > 0 && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️  Missing recommended environment variables:",
    missingRecommended.join(", ")
  );
}

// Validate JWT secret strength
if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}

// Validate Google OAuth configuration
try {
  validateGoogleConfig();
} catch (error) {
  console.error("❌ Google OAuth configuration error:", error.message);
  process.exit(1);
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} signal received: closing HTTP server`);
  server.close(() => {
    console.log("✅ HTTP server closed");
    // Close database connections
    const db = require("./config/database");
    db.end()
      .then(() => {
        console.log("✅ Database connections closed");
        process.exit(0);
      })
      .catch((err) => {
        console.error("❌ Error closing database:", err);
        process.exit(1);
      });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  if (process.env.NODE_ENV === "production") {
    // Log to monitoring service in production
    // e.g., Sentry, LogRocket, etc.
  } else {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  if (process.env.NODE_ENV === "production") {
    // Log to monitoring service
  }
  process.exit(1);
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";

const server = app.listen(PORT, HOST, () => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔬 Lab Management System API`);
  console.log("=".repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Platform: React Native Expo 54`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Local URL: http://${HOST}:${PORT}`);
  console.log(`🔐 Google OAuth: Mobile Only`);
  console.log(
    `📧 Email Notifications: ${process.env.SMTP_HOST ? "Enabled" : "Disabled"}`
  );
  console.log("=".repeat(60) + "\n");
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});

module.exports = app;
