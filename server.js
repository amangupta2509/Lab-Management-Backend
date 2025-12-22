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
} = require("./middleware/security");

const app = express();

// Trust proxy (required for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware - MUST BE FIRST
app.use(securityHeaders);

// CORS
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parser
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Prevent parameter pollution
app.use(preventPollution);

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(requestLogger);
}

// Serve static files (images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🔬 Lab Management System API",
    version: "1.0.0",
    status: "running",
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      user: "/api/user",
      equipment: "/api/equipment",
      bookings: "/api/bookings",
      usage: "/api/usage",
      activity: "/api/activity",
      admin: "/api/admin",
    },
  });
});

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const equipmentRoutes = require("./routes/equipment.routes");
const bookingRoutes = require("./routes/booking.routes");
const activityRoutes = require("./routes/activity.routes");
const usageRoutes = require("./routes/usage.routes");
const adminRoutes = require("./routes/admin.routes");

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use(sanitizeError);

// Validate environment variables
const requiredEnvVars = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("💤 HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("💤 HTTP server closed");
    process.exit(0);
  });
});

// Unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Don't crash in production, but log the error
  if (process.env.NODE_ENV === "development") {
    process.exit(1);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log("=================================");
});

module.exports = app;
