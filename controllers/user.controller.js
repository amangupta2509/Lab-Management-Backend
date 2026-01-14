const db = require("../config/database");
const bcrypt = require("bcryptjs");
const { deleteImageFile } = require("../middleware/upload");
const path = require("path");
const CONSTANTS = require("../config/constants");

// Get user's own profile (detailed)
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const [users] = await db.query(
      "SELECT id, name, email, role, phone, department, profile_image, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user statistics
    const [activityStats] = await db.query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_hours
       FROM activity_logs 
       WHERE user_id = ?`,
      [userId]
    );

    const [bookingStats] = await db.query(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_bookings,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_bookings
       FROM bookings 
       WHERE user_id = ?`,
      [userId]
    );

    const [usageStats] = await db.query(
      `SELECT 
        COUNT(*) as total_usage_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_usage_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_usage_hours
       FROM equipment_usage_sessions 
       WHERE user_id = ?`,
      [userId]
    );

    const [printStats] = await db.query(
      "SELECT COALESCE(SUM(print_count), 0) as total_prints FROM print_logs WHERE user_id = ?",
      [userId]
    );

    res.json({
      success: true,
      user: users[0],
      statistics: {
        activity: activityStats[0],
        bookings: bookingStats[0],
        usage: usageStats[0],
        prints: printStats[0],
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, phone, department } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    await db.query(
      "UPDATE users SET name = ?, phone = ?, department = ? WHERE id = ?",
      [name, phone, department, userId]
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Upload/Update profile image
exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Get old image path to delete it
    const [user] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [userId]
    );

    // Delete old image if exists
    if (user[0].profile_image) {
      const oldImagePath = path.join(__dirname, "..", user[0].profile_image);
      deleteImageFile(oldImagePath);
    }

    // Save new image path to database
    const imagePath = `uploads/users/${req.file.filename}`;
    await db.query("UPDATE users SET profile_image = ? WHERE id = ?", [
      imagePath,
      userId,
    ]);

    res.json({
      success: true,
      message: "Profile image uploaded successfully",
      imagePath: imagePath,
      imageUrl: `${req.protocol}://${req.get("host")}/${imagePath}`,
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete profile image
exports.deleteProfileImage = async (req, res) => {
  try {
    const userId = req.userId;

    // Get current image path
    const [user] = await db.query(
      "SELECT profile_image FROM users WHERE id = ?",
      [userId]
    );

    if (!user[0].profile_image) {
      return res.status(400).json({
        success: false,
        message: "No profile image to delete",
      });
    }

    // Delete image file
    const imagePath = path.join(__dirname, "..", user[0].profile_image);
    deleteImageFile(imagePath);

    // Update database
    await db.query("UPDATE users SET profile_image = NULL WHERE id = ?", [
      userId,
    ]);

    res.json({
      success: true,
      message: "Profile image deleted successfully",
    });
  } catch (error) {
    console.error("Delete profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Get current user
    const [users] = await db.query("SELECT password FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      users[0].password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get user dashboard summary
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.userId;

    // Today's activity
    const [todayActivity] = await db.query(
      `SELECT * FROM activity_logs 
       WHERE user_id = ? AND activity_date = CURDATE()
       ORDER BY sign_in_time DESC LIMIT 1`,
      [userId]
    );

    // Upcoming bookings
    const [upcomingBookings] = await db.query(
      `SELECT b.*, e.name as equipment_name, e.type as equipment_type
       FROM bookings b
       JOIN equipment e ON b.equipment_id = e.id
       WHERE b.user_id = ? 
       AND b.booking_date >= CURDATE()
       AND b.status IN ('pending', 'approved')
       ORDER BY b.booking_date ASC, b.start_time ASC
       LIMIT 5`,
      [userId]
    );

    // Recent notifications
    const [recentNotifications] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );

    // Unread notification count
    const [unreadCount] = await db.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false",
      [userId]
    );

    // This week's stats
    const [weekStats] = await db.query(
      `SELECT 
        COALESCE(SUM(duration_minutes), 0) as week_work_minutes,
        COUNT(*) as week_sessions
       FROM activity_logs 
       WHERE user_id = ? 
       AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [userId]
    );

    // Active usage session
    const [activeSession] = await db.query(
      `SELECT eus.*, e.name as equipment_name, b.booking_date
       FROM equipment_usage_sessions eus
       JOIN equipment e ON eus.equipment_id = e.id
       JOIN bookings b ON eus.booking_id = b.id
       WHERE eus.user_id = ? AND eus.end_time IS NULL
       LIMIT 1`,
      [userId]
    );

    res.json({
      success: true,
      dashboard: {
        todayActivity: todayActivity[0] || null,
        upcomingBookings,
        recentNotifications,
        unreadNotificationCount: unreadCount[0].count,
        weekStats: {
          workHours: (weekStats[0].week_work_minutes / 60).toFixed(2),
          sessions: weekStats[0].week_sessions,
        },
        activeSession: activeSession[0] || null,
      },
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get user's productivity report
exports.getMyProductivityReport = async (req, res) => {
  try {
    const userId = req.userId;
    const { date_from, date_to } = req.query;

    let dateFilter = "";
    const params = [userId];

    if (date_from && date_to) {
      dateFilter = "AND activity_date BETWEEN ? AND ?";
      params.push(date_from, date_to);
    } else {
      // Default to last 30 days
      dateFilter = "AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    }

    // Daily work hours
    const [dailyHours] = await db.query(
      `SELECT 
        activity_date,
        COUNT(*) as sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_hours
       FROM activity_logs 
       WHERE user_id = ? ${dateFilter}
       GROUP BY activity_date
       ORDER BY activity_date DESC`,
      params
    );

    // Equipment usage breakdown
    const [equipmentUsage] = await db.query(
      `SELECT 
        e.name as equipment_name,
        e.type as equipment_type,
        COUNT(*) as usage_count,
        COALESCE(SUM(eus.duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(eus.duration_minutes) / 60, 2), 0) as total_hours
       FROM equipment_usage_sessions eus
       JOIN equipment e ON eus.equipment_id = e.id
       WHERE eus.user_id = ?
       GROUP BY eus.equipment_id
       ORDER BY total_hours DESC`,
      [userId]
    );

    // Total summary
    const [summary] = await db.query(
      `SELECT 
        COUNT(DISTINCT al.id) as total_lab_sessions,
        COALESCE(SUM(al.duration_minutes), 0) as total_work_minutes,
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT eus.id) as total_usage_sessions,
        COALESCE(SUM(pl.print_count), 0) as total_prints
       FROM activity_logs al
       LEFT JOIN bookings b ON al.user_id = b.user_id
       LEFT JOIN equipment_usage_sessions eus ON al.user_id = eus.user_id
       LEFT JOIN print_logs pl ON al.user_id = pl.user_id
       WHERE al.user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      report: {
        summary: {
          totalLabSessions: summary[0].total_lab_sessions,
          totalWorkHours: (summary[0].total_work_minutes / 60).toFixed(2),
          totalBookings: summary[0].total_bookings,
          totalUsageSessions: summary[0].total_usage_sessions,
          totalPrints: summary[0].total_prints,
        },
        dailyHours,
        equipmentUsage,
      },
    });
  } catch (error) {
    console.error("Get productivity report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
