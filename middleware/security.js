const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const hpp = require("hpp");
const CONSTANTS = require("../config/constants");

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.API.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.API.MAX_REQUESTS,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === "development";
  },
});

// Strict rate limiter for authentication routes
exports.authLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.AUTH.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.AUTH.MAX_REQUESTS,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for booking creation
exports.bookingLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.BOOKING.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.BOOKING.MAX_REQUESTS,
  message: {
    success: false,
    message: "Too many booking requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
exports.uploadLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMITS.UPLOAD.WINDOW_MS,
  max: CONSTANTS.RATE_LIMITS.UPLOAD.MAX_REQUESTS,
  message: {
    success: false,
    message: "Too many upload requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure helmet for security headers (Mobile-optimized)
// Simplified for React Native - remove web-specific CSP
exports.securityHeaders = helmet({
  contentSecurityPolicy: false, // Not needed for mobile APIs
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: false, // Not applicable to mobile
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "no-referrer" },
});

// Prevent HTTP Parameter Pollution
exports.preventPollution = hpp({
  whitelist: [
    "status",
    "type",
    "role",
    "page",
    "limit",
    "sort",
    "days",
    "date_from",
    "date_to",
  ],
});

// Custom middleware to sanitize file names
exports.sanitizeFileName = (req, res, next) => {
  if (req.file) {
    req.file.originalname = req.file.originalname.replace(/\.\./g, "");
    req.file.originalname = req.file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    );
  }
  next();
};

// CORS configuration - OPTIMIZED FOR REACT NATIVE
exports.corsOptions = {
  origin: function (origin, callback) {
    // React Native doesn't send origin header
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    // In production, check allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [];

    if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Still allow for mobile apps without origin
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Client-Type",
    "X-App-Version",
    "X-Device-Id",
    "X-Platform",
  ],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
};

// Request logging middleware
exports.requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const clientType = req.get("X-Client-Type") || "unknown";
    const appVersion = req.get("X-App-Version") || "unknown";
    const platform = req.get("X-Platform") || "unknown";

    if (process.env.NODE_ENV === "development") {
      console.log(
        `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${platform}/${clientType} v${appVersion}`
      );
    }
  });

  next();
};

// Error sanitizer - never expose sensitive info in production
exports.sanitizeError = (err, req, res, next) => {
  console.error("Error:", err);

  const isDevelopment = process.env.NODE_ENV === "development";

  // Don't expose sensitive information in production
  const sanitizedMessage = isDevelopment
    ? err.message
    : "An error occurred processing your request";

  res.status(err.status || 500).json({
    success: false,
    message: sanitizedMessage,
    ...(isDevelopment && {
      stack: err.stack,
      details: err.details,
    }),
  });
};

// Middleware to detect and log mobile client info
exports.mobileClientInfo = (req, res, next) => {
  const clientType = req.get("X-Client-Type");
  const appVersion = req.get("X-App-Version");
  const deviceId = req.get("X-Device-Id");
  const platform = req.get("X-Platform");

  if (clientType === "mobile" || platform) {
    req.mobileClient = {
      type: clientType || "mobile",
      version: appVersion,
      deviceId: deviceId,
      platform:
        platform ||
        (req.get("User-Agent")?.includes("Android") ? "android" : "ios"),
    };
  }

  next();
};

// Input validation sanitizer
exports.sanitizeInput = (req, res, next) => {
  // Sanitize common injection patterns
  const sanitizeString = (str) => {
    if (typeof str !== "string") return str;
    // Only remove SQL injection patterns, not all special characters
    // Allow semicolons in text but prevent SQL injection
    return str.replace(
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/gi,
      ""
    );
  };

  // Recursively sanitize request body
  const sanitizeObject = (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === "string") {
          sanitized[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === "object") {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }

    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};
