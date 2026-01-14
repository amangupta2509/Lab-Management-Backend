/**
 * Admin Only Middleware
 * Allows access only to users with role = 'admin'
 */

module.exports = (req, res, next) => {
  try {
    // auth middleware already sets req.userId & req.userRole
    if (!req.userRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Role not found."
      });
    }

    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authorization failed"
    });
  }
};
