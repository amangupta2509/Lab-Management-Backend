const { body, param, query, validationResult } = require("express-validator");

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Auth validation rules
exports.validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  body("phone")
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage("Phone number must be 10 digits"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department name too long"),

  handleValidationErrors,
];

exports.validateLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

exports.validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  handleValidationErrors,
];

// Booking validation rules
exports.validateBooking = [
  body("equipment_id")
    .notEmpty()
    .withMessage("Equipment ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid equipment ID"),

  body("booking_date")
    .notEmpty()
    .withMessage("Booking date is required")
    .isDate()
    .withMessage("Invalid date format")
    .custom((value) => {
      const bookingDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        throw new Error("Booking date cannot be in the past");
      }
      return true;
    }),

  body("start_time")
    .notEmpty()
    .withMessage("Start time is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid time format (use HH:mm)"),

  body("end_time")
    .notEmpty()
    .withMessage("End time is required")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid time format (use HH:mm)")
    .custom((endTime, { req }) => {
      // IMPROVED: Convert to minutes for comparison
      const [startHour, startMin] = req.body.start_time.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),

  body("purpose")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Purpose too long (max 500 characters)"),

  handleValidationErrors,
];

// Equipment validation rules
exports.validateEquipment = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Equipment name is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Name must be between 2 and 200 characters"),

  body("type")
    .trim()
    .notEmpty()
    .withMessage("Equipment type is required")
    .isLength({ max: 100 })
    .withMessage("Type too long"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description too long (max 1000 characters)"),

  body("model_number")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Model number too long"),

  body("serial_number")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Serial number too long"),

  body("status")
    .optional()
    .isIn(["available", "in_use", "maintenance", "deleted"])
    .withMessage("Invalid status"),

  handleValidationErrors,
];

// Usage session validation
exports.validateStartSession = [
  body("booking_id")
    .notEmpty()
    .withMessage("Booking ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid booking ID"),

  handleValidationErrors,
];

exports.validateEndSession = [
  body("session_id")
    .notEmpty()
    .withMessage("Session ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid session ID"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes too long (max 1000 characters)"),

  handleValidationErrors,
];

// Print log validation
exports.validatePrintLog = [
  body("print_count")
    .notEmpty()
    .withMessage("Print count is required")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Print count must be between 1 and 1000"),

  body("document_name")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Document name too long"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes too long (max 500 characters)"),

  handleValidationErrors,
];

// Profile update validation
exports.validateProfile = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage("Phone number must be 10 digits"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department name too long"),

  handleValidationErrors,
];

// ID parameter validation
exports.validateId = [
  param("id")
    .notEmpty()
    .withMessage("ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid ID"),

  handleValidationErrors,
];

// Pagination validation
exports.validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  handleValidationErrors,
];

// Date range validation
exports.validateDateRange = [
  query("date_from")
    .optional()
    .isDate()
    .withMessage("Invalid date format for date_from"),

  query("date_to")
    .optional()
    .isDate()
    .withMessage("Invalid date format for date_to")
    .custom((dateTo, { req }) => {
      if (req.query.date_from && dateTo < req.query.date_from) {
        throw new Error("date_to must be after date_from");
      }
      return true;
    }),

  handleValidationErrors,
];
