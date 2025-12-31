const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const hpp = require("hpp");

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication routes
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for booking creation
exports.bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 bookings per hour
  message: {
    success: false,
    message: "Too many booking requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
exports.uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    success: false,
    message: "Too many upload requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure helmet for security headers
exports.securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: "deny",
  },
  noSniff: true,
  xssFilter: true,
});

// Prevent HTTP Parameter Pollution
exports.preventPollution = hpp({
  whitelist: ["status", "type", "role", "page", "limit", "sort"], // Allow duplicate params for these fields
});

// Custom middleware to sanitize file names
exports.sanitizeFileName = (req, res, next) => {
  if (req.file) {
    // Remove any path traversal attempts
    req.file.originalname = req.file.originalname.replace(/\.\./g, "");
    // Remove special characters except dots and hyphens
    req.file.originalname = req.file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    );
  }
  next();
};

// CORS configuration - FIXED FOR MOBILE APP
exports.corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    // Allow requests with no origin (like mobile apps, Postman, curl)
    // THIS IS CRITICAL FOR MOBILE APPS
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:8081", // Expo web default
          "http://127.0.0.1:8081", // Expo web alternative
          "http://10.51.182.136:8081", // ✅ Your computer's IP for Expo dev
          "http://10.75.127.122:8081", // Old IP (keep for reference)
        ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Origin not allowed:", origin);
      // ✅ ALLOW ALL ORIGINS FOR TESTING - Mobile apps often have no origin
      callback(null, true); // Allow in development/testing
      // callback(new Error('Not allowed by CORS')); // Use this in production
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Client-Type"],
};

// Request logging middleware
exports.requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log after response is sent
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - Origin: ${req.get('origin') || 'no-origin'}`
    );
  });

  next();
};

// Error sanitizer - don't expose internal errors
exports.sanitizeError = (err, req, res, next) => {
  console.error("Error:", err);

  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
};