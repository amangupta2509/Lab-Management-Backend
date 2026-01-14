/**
 * Authentication & Authorization Middleware
 * Lab Management System
 */

const jwt = require("jsonwebtoken");
const db = require("../config/database");

/* =====================================================
   VERIFY JWT TOKEN
   ===================================================== */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token."
      });
    }

    console.error("JWT verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to authenticate token."
    });
  }
};

/* =====================================================
   CHECK ACTIVE USER
   ===================================================== */
const isActive = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const [users] = await db.query(
      "SELECT is_active FROM users WHERE id = ?",
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found."
      });
    }

    if (!users[0].is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator."
      });
    }

    next();
  } catch (error) {
    console.error("isActive check error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking account status."
    });
  }
};

/* =====================================================
   ADMIN ONLY ACCESS
   ===================================================== */
const isAdmin = (req, res, next) => {
  if (!req.userRole) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Role not found."
    });
  }

  if (req.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required."
    });
  }

  next();
};

/* =====================================================
   EXPORTS
   ===================================================== */
module.exports = {
  verifyToken,
  isActive,
  isAdmin
};
