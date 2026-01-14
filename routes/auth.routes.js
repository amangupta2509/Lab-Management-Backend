const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth");
const { validateRegister, validateLogin } = require("../middleware/validation");
const { authLimiter } = require("../middleware/security");

// ========================================
// TRADITIONAL AUTHENTICATION
// ========================================

// Register with email/password
router.post(
  "/register",
  authLimiter,
  validateRegister,
  authController.register
);

// Login with email/password
router.post("/login", authLimiter, validateLogin, authController.login);

// Password reset flow
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

// ========================================
// MOBILE GOOGLE OAUTH (React Native Expo)
// ========================================

/**
 * Mobile Google Sign-In for React Native Expo
 *
 * POST /api/auth/google/mobile
 * Headers:
 *   Content-Type: application/json
 *   X-Client-Type: mobile
 *   X-Platform: ios|android
 * Body: { "idToken": "eyJhbGciOiJSUzI1NiIs..." }
 *
 * Response: { "success": true, "token": "...", "user": {...} }
 */
router.post("/google/mobile", authLimiter, authController.googleMobileAuth);

// ========================================
// PROTECTED ROUTES
// ========================================

// Logout (JWT-based, client-side token removal)
router.post("/logout", verifyToken, authController.logout);

// Refresh JWT token
router.post("/refresh-token", verifyToken, authController.refreshToken);

// Verify current token
router.get("/verify", verifyToken, authController.verifyToken);

module.exports = router;
