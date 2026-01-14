const db = require("../config/database");
const CONSTANTS = require('../config/constants');

// Get user's activity logs
exports.getMyActivity = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [activities] = await db.query(
      "SELECT * FROM activity_logs WHERE user_id = ? ORDER BY sign_in_time DESC LIMIT ? OFFSET ?",
      [userId, parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?",
      [userId]
    );

    // Calculate total work hours
    const totalMinutes = activities.reduce((sum, activity) => {
      return sum + (activity.duration_minutes || 0);
    }, 0);

    res.json({
      success: true,
      count: activities.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      totalWorkHours: (totalMinutes / 60).toFixed(2),
      activities,
    });
  } catch (error) {
    console.error("Get activity error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.autoSignIn = async (userId) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT * FROM activity_logs WHERE user_id = ? AND activity_date = CURDATE() AND sign_out_time IS NULL FOR UPDATE",
      [userId]
    );

    if (existing.length === 0) {
      await connection.query(
        "INSERT INTO activity_logs (user_id, activity_date, sign_in_time) VALUES (?, CURDATE(), NOW())",
        [userId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Auto sign-in error:", error);
  } finally {
    connection.release();
  }
};

// NEW: Manual sign-in endpoint
exports.signIn = async (req, res) => {
  try {
    const userId = req.userId;

    // Check if already signed in today
    const [existing] = await db.query(
      `SELECT * FROM activity_logs 
       WHERE user_id = ? 
       AND activity_date = CURDATE() 
       AND sign_out_time IS NULL`,
      [userId]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: "Already signed in today",
        activity: existing[0],
      });
    }

    // Create new activity log
    const [result] = await db.query(
      `INSERT INTO activity_logs (user_id, activity_date, sign_in_time) 
       VALUES (?, CURDATE(), NOW())`,
      [userId]
    );

    // Get the created activity
    const [newActivity] = await db.query(
      `SELECT * FROM activity_logs WHERE id = ?`,
      [result.insertId]
    );

    // Create lab logbook entry
    const [user] = await db.query("SELECT name FROM users WHERE id = ?", [
      userId,
    ]);
    await db.query(
      `INSERT INTO lab_logbook (user_id, activity_type, description) 
       VALUES (?, ?, ?)`,
      [userId, "sign_in", `${user[0].name} signed in to lab`]
    );

    res.json({
      success: true,
      message: "Signed in successfully",
      activity: newActivity[0],
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// NEW: Auto sign-out
exports.autoSignOut = async (req, res) => {
  try {
    const userId = req.userId;

    // Find today's open session
    const [session] = await db.query(
      "SELECT * FROM activity_logs WHERE user_id = ? AND activity_date = CURDATE() AND sign_out_time IS NULL",
      [userId]
    );

    if (session.length > 0) {
      await db.query(
        "UPDATE activity_logs SET sign_out_time = NOW() WHERE id = ?",
        [session[0].id]
      );
    }

    res.json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Auto sign-out error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// Get all users' activity logs (Admin)
exports.getAllActivity = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [activities] = await db.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM activity_logs al
       JOIN users u ON al.user_id = u.id
       ORDER BY al.sign_in_time DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM activity_logs"
    );

    res.json({
      success: true,
      count: activities.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      activities,
    });
  } catch (error) {
    console.error("Get all activity error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get lab logbook
exports.getLabLogbook = async (req, res) => {
  try {
    const {
      activity_type,
      user_id,
      date_from,
      date_to,
      page = 1,
      limit = 50,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT ll.*,
        u.name as user_name,
        e.name as equipment_name
      FROM lab_logbook ll
      JOIN users u ON ll.user_id = u.id
      LEFT JOIN equipment e ON ll.equipment_id = e.id
      WHERE 1=1
    `;

    const params = [];

    if (activity_type) {
      query += " AND ll.activity_type = ?";
      params.push(activity_type);
    }

    if (user_id) {
      query += " AND ll.user_id = ?";
      params.push(user_id);
    }

    if (date_from) {
      query += " AND DATE(ll.created_at) >= ?";
      params.push(date_from);
    }

    if (date_to) {
      query += " AND DATE(ll.created_at) <= ?";
      params.push(date_to);
    }

    query += " ORDER BY ll.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [logbook] = await db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM lab_logbook ll
      WHERE 1=1
    `;
    const countParams = [];
    if (activity_type) {
      countQuery += " AND ll.activity_type = ?";
      countParams.push(activity_type);
    }
    if (user_id) {
      countQuery += " AND ll.user_id = ?";
      countParams.push(user_id);
    }
    if (date_from) {
      countQuery += " AND DATE(ll.created_at) >= ?";
      countParams.push(date_from);
    }
    if (date_to) {
      countQuery += " AND DATE(ll.created_at) <= ?";
      countParams.push(date_to);
    }

    const [countResult] = await db.query(countQuery, countParams);

    res.json({
      success: true,
      count: logbook.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      logbook,
    });
  } catch (error) {
    console.error("Get logbook error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get user's notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [notifications] = await db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [userId, parseInt(limit), offset]
    );

    // Count unread notifications
    const [unreadCount] = await db.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false",
      [userId]
    );

    const [totalCount] = await db.query(
      "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?",
      [userId]
    );

    res.json({
      success: true,
      count: notifications.length,
      total: totalCount[0].total,
      totalPages: Math.ceil(totalCount[0].total / limit),
      currentPage: parseInt(page),
      unreadCount: unreadCount[0].count,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Mark notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await db.query(
      "UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Add print log
exports.addPrintLog = async (req, res) => {
  try {
    const userId = req.userId;
    const { print_count, document_name, notes } = req.body;

    if (!print_count) {
      return res.status(400).json({
        success: false,
        message: "Print count is required",
      });
    }

    const [result] = await db.query(
      "INSERT INTO print_logs (user_id, print_count, document_name, print_date, notes) VALUES (?, ?, ?, CURDATE(), ?)",
      [userId, print_count, document_name, notes]
    );

    res.status(201).json({
      success: true,
      message: "Print log added successfully",
      printLogId: result.insertId,
    });
  } catch (error) {
    console.error("Add print log error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get user's print logs
exports.getMyPrintLogs = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [printLogs] = await db.query(
      "SELECT * FROM print_logs WHERE user_id = ? ORDER BY print_date DESC LIMIT ? OFFSET ?",
      [userId, parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM print_logs WHERE user_id = ?",
      [userId]
    );

    // Calculate total prints
    const totalPrints = printLogs.reduce((sum, log) => {
      return sum + log.print_count;
    }, 0);

    res.json({
      success: true,
      count: printLogs.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      totalPrints,
      printLogs,
    });
  } catch (error) {
    console.error("Get print logs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
