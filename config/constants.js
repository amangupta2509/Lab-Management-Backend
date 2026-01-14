/**
 * Application Constants
 * Centralized configuration for production deployment
 */

module.exports = {
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
  },

  // Working Hours
  BUSINESS: {
    WORK_HOURS_PER_DAY: parseInt(process.env.WORK_HOURS_PER_DAY) || 8,
    WORK_DAYS_PER_WEEK: parseInt(process.env.WORK_DAYS_PER_WEEK) || 5,
    LAB_START_TIME: process.env.LAB_START_TIME || "09:00",
    LAB_END_TIME: process.env.LAB_END_TIME || "17:00",
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ],
    ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    USER_IMAGES_DIR: "./uploads/users",
    EQUIPMENT_IMAGES_DIR: "./uploads/equipment",
    BASE_UPLOAD_DIR: "./uploads",
  },

  // Rate Limiting
  RATE_LIMITS: {
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100,
    },
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 10,
    },
    BOOKING: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 10,
    },
    UPLOAD: {
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      MAX_REQUESTS: 20,
    },
  },

  // Utilization Thresholds
  ANALYTICS: {
    UNDERUSED_THRESHOLD: parseInt(process.env.UNDERUSED_THRESHOLD) || 20, // percentage
    OVERLOADED_THRESHOLD: parseInt(process.env.OVERLOADED_THRESHOLD) || 80, // percentage
    DEFAULT_ANALYTICS_DAYS: 30,
    MAX_ANALYTICS_DAYS: 365,
  },

  // Password Rules
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: false,
  },

  // Session & Token
  SESSION: {
    JWT_EXPIRY: process.env.JWT_EXPIRES_IN || "24h",
    RESET_TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour
    SESSION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Print Logs
  PRINT: {
    MIN_COUNT: 1,
    MAX_COUNT: 1000,
    MAX_DOCUMENT_NAME_LENGTH: 200,
  },

  // Validation
  VALIDATION: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    PHONE_LENGTH: 10,
    EMAIL_MAX_LENGTH: 255,
    DEPARTMENT_MAX_LENGTH: 100,
    NOTES_MAX_LENGTH: 1000,
    PURPOSE_MAX_LENGTH: 500,
    DESCRIPTION_MAX_LENGTH: 1000,
  },

  // User Roles
  ROLES: {
    USER: "user",
    ADMIN: "admin",
  },

  // Equipment Status
  EQUIPMENT_STATUS: {
    AVAILABLE: "available",
    IN_USE: "in_use",
    MAINTENANCE: "maintenance",
    DELETED: "deleted",
  },

  // Booking Status
  BOOKING_STATUS: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELLED: "cancelled",
    COMPLETED: "completed",
  },

  // Activity Types
  ACTIVITY_TYPES: {
    BOOKING_CREATED: "booking_created",
    BOOKING_APPROVED: "booking_approved",
    BOOKING_REJECTED: "booking_rejected",
    USAGE_STARTED: "usage_started",
    USAGE_ENDED: "usage_ended",
    SIGN_IN: "sign_in",
    SIGN_OUT: "sign_out",
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    INFO: "info",
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
    APPROVAL: "approval",
    REJECTION: "rejection",
  },

  // OAuth Providers
  OAUTH_PROVIDERS: {
    LOCAL: "local",
    GOOGLE: "google",
  },

  // API Response
  RESPONSE: {
    SUCCESS: true,
    FAILURE: false,
  },
};
