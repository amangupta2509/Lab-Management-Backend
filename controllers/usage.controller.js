const db = require('../config/database');

// Start usage session
exports.startSession = async (req, res) => {
  try {
    const userId = req.userId;
    const { booking_id } = req.body;

    // Validation
    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Check if booking exists, is approved, and belongs to user
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ? AND status = "approved"',
      [booking_id, userId]
    );

    if (booking.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Approved booking not found'
      });
    }

    // Check if session already exists for this booking
    const [existingSession] = await db.query(
      'SELECT * FROM equipment_usage_sessions WHERE booking_id = ? AND end_time IS NULL',
      [booking_id]
    );

    if (existingSession.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Session already started for this booking'
      });
    }

    // Create usage session
    const [result] = await db.query(
      'INSERT INTO equipment_usage_sessions (booking_id, user_id, equipment_id, start_time) VALUES (?, ?, ?, NOW())',
      [booking_id, userId, booking[0].equipment_id]
    );

    // Create lab logbook entry
    const [user] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
    const [equipment] = await db.query('SELECT name FROM equipment WHERE id = ?', [booking[0].equipment_id]);
    await db.query(
      'INSERT INTO lab_logbook (user_id, activity_type, equipment_id, booking_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'usage_started', booking[0].equipment_id, booking_id, `${user[0].name} started using ${equipment[0].name}`]
    );

    res.status(201).json({
      success: true,
      message: 'Usage session started',
      sessionId: result.insertId
    });

  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// End usage session
exports.endSession = async (req, res) => {
  try {
    const userId = req.userId;
    const { session_id, notes } = req.body;

    // Validation
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Check if session exists and belongs to user
    const [session] = await db.query(
      'SELECT * FROM equipment_usage_sessions WHERE id = ? AND user_id = ? AND end_time IS NULL',
      [session_id, userId]
    );

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    // Update session with end time
    await db.query(
      'UPDATE equipment_usage_sessions SET end_time = NOW(), notes = ? WHERE id = ?',
      [notes, session_id]
    );

    // Create lab logbook entry
    const [user] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
    const [equipment] = await db.query('SELECT name FROM equipment WHERE id = ?', [session[0].equipment_id]);
    await db.query(
      'INSERT INTO lab_logbook (user_id, activity_type, equipment_id, booking_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'usage_ended', session[0].equipment_id, session[0].booking_id, `${user[0].name} finished using ${equipment[0].name}`]
    );

    // Update booking status to completed
    await db.query(
      'UPDATE bookings SET status = "completed" WHERE id = ?',
      [session[0].booking_id]
    );

    res.json({
      success: true,
      message: 'Usage session ended successfully'
    });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get user's usage sessions
exports.getMySessions = async (req, res) => {
  try {
    const userId = req.userId;

    const [sessions] = await db.query(
      `SELECT eus.*, 
              e.name as equipment_name, 
              e.type as equipment_type,
              b.booking_date
       FROM equipment_usage_sessions eus
       JOIN equipment e ON eus.equipment_id = e.id
       JOIN bookings b ON eus.booking_id = b.id
       WHERE eus.user_id = ?
       ORDER BY eus.start_time DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all usage sessions (Admin)
exports.getAllSessions = async (req, res) => {
  try {
    const [sessions] = await db.query(
      `SELECT eus.*, 
              u.name as user_name,
              e.name as equipment_name, 
              e.type as equipment_type,
              b.booking_date
       FROM equipment_usage_sessions eus
       JOIN users u ON eus.user_id = u.id
       JOIN equipment e ON eus.equipment_id = e.id
       JOIN bookings b ON eus.booking_id = b.id
       ORDER BY eus.start_time DESC`
    );

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get usage sessions by equipment (Admin)
exports.getSessionsByEquipment = async (req, res) => {
  try {
    const { equipment_id } = req.params;

    const [sessions] = await db.query(
      `SELECT eus.*, 
              u.name as user_name,
              e.name as equipment_name,
              b.booking_date
       FROM equipment_usage_sessions eus
       JOIN users u ON eus.user_id = u.id
       JOIN equipment e ON eus.equipment_id = e.id
       JOIN bookings b ON eus.booking_id = b.id
       WHERE eus.equipment_id = ?
       ORDER BY eus.start_time DESC`,
      [equipment_id]
    );

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get equipment sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};