const db = require("../config/database");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const [[totalUsers]] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE is_active = true"
    );

    const [[totalEquipment]] = await db.query(
      'SELECT COUNT(*) as count FROM equipment WHERE status != "deleted"'
    );

    const [[availableEquipment]] = await db.query(
      'SELECT COUNT(*) as count FROM equipment WHERE status = "available"'
    );

    const [[pendingBookings]] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE status = "pending"'
    );

    const [[todayBookings]] = await db.query(
      "SELECT COUNT(*) as count FROM bookings WHERE booking_date = CURDATE()"
    );

    const [[activeToday]] = await db.query(
      "SELECT COUNT(DISTINCT user_id) as count FROM activity_logs WHERE activity_date = CURDATE()"
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.count,
        activeUsers: activeToday.count,
        totalEquipment: totalEquipment.count,
        availableEquipment: availableEquipment.count,
        pendingBookings: pendingBookings.count,
        todayBookings: todayBookings.count,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Peak hours analysis
exports.getPeakHoursAnalysis = async (req, res) => {
  try {
    const [peakHours] = await db.query(`
      SELECT 
        HOUR(start_time) as hour_of_day,
        COUNT(*) as session_count
      FROM equipment_usage_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY HOUR(start_time)
      ORDER BY hour_of_day
    `);

    res.json({ success: true, peak_hours: peakHours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// NEW: Daily usage patterns
exports.getDailyUsagePatterns = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const [patterns] = await db.query(
      `
      SELECT 
        DATE(start_time) as usage_date,
        COUNT(*) as session_count,
        SUM(duration_minutes) as total_minutes
      FROM equipment_usage_sessions
      WHERE start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(start_time)
      ORDER BY usage_date DESC
    `,
      [days]
    );

    res.json({ success: true, patterns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user basic info
    const [[user]] = await db.query(
      `SELECT id, name, email, role, department, phone, created_at, is_active
       FROM users 
       WHERE id = ?`,
      [id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get work hours from activity logs
    const [activityStats] = await db.query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_hours,
        MIN(sign_in_time) as first_activity,
        MAX(sign_out_time) as last_activity
       FROM activity_logs
       WHERE user_id = ?`,
      [id]
    );

    // Get equipment usage statistics
    const [equipmentUsage] = await db.query(
      `SELECT 
        e.id,
        e.name as equipment_name,
        e.type as equipment_type,
        COUNT(eus.id) as usage_count,
        COALESCE(SUM(eus.duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(eus.duration_minutes) / 60, 2), 0) as total_hours,
        MAX(eus.start_time) as last_used
       FROM equipment_usage_sessions eus
       JOIN equipment e ON eus.equipment_id = e.id
       WHERE eus.user_id = ?
       GROUP BY e.id, e.name, e.type
       ORDER BY total_hours DESC`,
      [id]
    );

    // Get booking statistics
    const [bookingStats] = await db.query(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_bookings,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_bookings,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings
       FROM bookings
       WHERE user_id = ?`,
      [id]
    );

    // Get recent activity
    const [recentActivity] = await db.query(
      `SELECT 
        activity_date,
        sign_in_time,
        sign_out_time,
        duration_minutes
       FROM activity_logs
       WHERE user_id = ?
       ORDER BY activity_date DESC, sign_in_time DESC
       LIMIT 10`,
      [id]
    );

    // Get print logs
    const [printStats] = await db.query(
      `SELECT 
        COALESCE(SUM(print_count), 0) as total_prints,
        COUNT(*) as print_sessions
       FROM print_logs
       WHERE user_id = ?`,
      [id]
    );

    res.json({
      success: true,
      user,
      statistics: {
        activity: activityStats[0],
        bookings: bookingStats[0],
        prints: printStats[0],
      },
      equipmentUsage,
      recentActivity,
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getMachineUtilizationAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const WORK_HOURS_PER_DAY = 8;
    const TOTAL_AVAILABLE_HOURS = WORK_HOURS_PER_DAY * days;

    const [rows] = await db.query(
      `
      SELECT
        e.id,
        e.name,
        e.type,
        COUNT(eus.id) as total_sessions,

        COALESCE(
          ROUND(
            SUM(TIMESTAMPDIFF(
              MINUTE,
              eus.start_time,
              COALESCE(eus.end_time, NOW())
            )
          ) / 60,
          2
        ),
        0
      ) AS total_hours,

      MAX(eus.start_time) as last_used
    FROM equipment e
    LEFT JOIN equipment_usage_sessions eus
      ON e.id = eus.equipment_id
      AND eus.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
    WHERE e.status != "deleted"
    GROUP BY e.id
    ORDER BY total_hours DESC
    `,
      [days]
    );

    let underusedCount = 0;
    let overloadedCount = 0;

    const machines = rows.map((m) => {
      const utilizationPercent =
        TOTAL_AVAILABLE_HOURS > 0
          ? Math.min(
              Math.round(
                (parseFloat(m.total_hours) / TOTAL_AVAILABLE_HOURS) * 100
              ),
              100
            )
          : 0;

      // Count underused (<20%) and overloaded (>80%)
      if (utilizationPercent < 20 && parseFloat(m.total_hours) > 0) {
        underusedCount++;
      }
      if (utilizationPercent > 80) {
        overloadedCount++;
      }

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        total_sessions: m.total_sessions,
        total_hours: m.total_hours,
        utilization_percent: utilizationPercent,
        last_used: m.last_used,
      };
    });

    // Calculate summary statistics
    const totalMachines = machines.length;
    const totalHours = machines.reduce(
      (sum, m) => sum + parseFloat(m.total_hours),
      0
    );
    const averageUtilizationHours =
      totalMachines > 0 ? (totalHours / totalMachines).toFixed(2) : 0;

    res.json({
      success: true,
      period_days: days,
      summary: {
        total_machines: totalMachines,
        average_utilization_hours: parseFloat(averageUtilizationHours),
        underused_count: underusedCount,
        overloaded_count: overloadedCount,
      },
      machines,
    });
  } catch (err) {
    console.error("Utilization analytics error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get equipment utilization report
exports.getEquipmentUtilization = async (req, res) => {
  try {
    const [utilization] = await db.query(
      `SELECT
        e.id,
        e.name,
        e.type,
        COUNT(DISTINCT eus.id) as total_sessions,
        COALESCE(SUM(eus.duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(eus.duration_minutes) / 60, 2), 0) as total_hours,
        MAX(eus.start_time) as last_used
       FROM equipment e
       LEFT JOIN equipment_usage_sessions eus ON e.id = eus.equipment_id
       WHERE e.status != "deleted"
       GROUP BY e.id, e.name, e.type
       ORDER BY total_hours DESC`
    );

    res.json({
      success: true,
      count: utilization.length,
      utilization,
    });
  } catch (error) {
    console.error("Get utilization error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get user productivity report
exports.getUserProductivity = async (req, res) => {
  try {
    const [productivity] = await db.query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.department,
        COUNT(DISTINCT al.id) as lab_sessions,
        COALESCE(SUM(al.duration_minutes), 0) as work_minutes,
        COALESCE(ROUND(SUM(al.duration_minutes) / 60, 2), 0) as work_hours,
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT eus.id) as machine_sessions,
        COALESCE(SUM(pl.print_count), 0) as total_prints
       FROM users u
       LEFT JOIN activity_logs al ON u.id = al.user_id
       LEFT JOIN bookings b ON u.id = b.user_id
       LEFT JOIN equipment_usage_sessions eus ON u.id = eus.user_id
       LEFT JOIN print_logs pl ON u.id = pl.user_id
       WHERE u.is_active = true AND u.role = "user"
       GROUP BY u.id, u.name, u.email, u.department
       ORDER BY work_hours DESC`
    );

    res.json({
      success: true,
      count: productivity.length,
      productivity,
    });
  } catch (error) {
    console.error("Get productivity error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get booking analytics
exports.getBookingAnalytics = async (req, res) => {
  try {
    // Bookings by status
    const [byStatus] = await db.query(
      `SELECT status, COUNT(*) as count
       FROM bookings
       GROUP BY status`
    );

    // Bookings by equipment
    const [byEquipment] = await db.query(
      `SELECT e.name, COUNT(*) as booking_count
       FROM bookings b
       JOIN equipment e ON b.equipment_id = e.id
       GROUP BY b.equipment_id
       ORDER BY booking_count DESC
       LIMIT 10`
    );

    // Recent bookings trend (last 7 days)
    const [trend] = await db.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
       FROM bookings
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    res.json({
      success: true,
      analytics: {
        byStatus,
        byEquipment,
        trend,
      },
    });
  } catch (error) {
    console.error("Get booking analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all users (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [users] = await db.query(
      `SELECT 
         id,
         name,
         email,
         role,
         department,
         phone,          
         is_active,
         created_at      
       FROM users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    const [[count]] = await db.query("SELECT COUNT(*) as total FROM users");

    res.json({
      success: true,
      users,
      total: count.total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Toggle user status (Admin)
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [[user]] = await db.query(
      "SELECT is_active FROM users WHERE id = ?",
      [id]
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [
      !user.is_active,
      id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
