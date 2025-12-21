const db = require('../config/database');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Total users
    const [totalUsers] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = true'
    );

    // Total equipment
    const [totalEquipment] = await db.query(
      'SELECT COUNT(*) as count FROM equipment WHERE status != "deleted"'
    );

    // Total bookings
    const [totalBookings] = await db.query(
      'SELECT COUNT(*) as count FROM bookings'
    );

    // Pending bookings
    const [pendingBookings] = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE status = "pending"'
    );

    // Today's active users
    const [activeToday] = await db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM activity_logs WHERE activity_date = CURDATE()'
    );

    // Most used equipment
    const [mostUsed] = await db.query(
      `SELECT e.name, COUNT(*) as usage_count
       FROM equipment_usage_sessions eus
       JOIN equipment e ON eus.equipment_id = e.id
       GROUP BY eus.equipment_id
       ORDER BY usage_count DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0].count,
        totalEquipment: totalEquipment[0].count,
        totalBookings: totalBookings[0].count,
        pendingBookings: pendingBookings[0].count,
        activeToday: activeToday[0].count,
        mostUsedEquipment: mostUsed
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
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
      utilization
    });

  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
      productivity
    });

  } catch (error) {
    console.error('Get productivity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
        trend
      }
    });

  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get all users (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [users] = await db.query(
      'SELECT id, name, email, role, phone, department, created_at, is_active FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM users'
    );

    res.json({
      success: true,
      count: users.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Toggle user status (Admin)
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [user] = await db.query('SELECT is_active FROM users WHERE id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const newStatus = !user[0].is_active;

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};