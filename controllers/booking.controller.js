const db = require("../config/database");

// Create new booking
exports.createBooking = async (req, res) => {
  try {
    const userId = req.userId;
    const { equipment_id, booking_date, start_time, end_time, purpose } =
      req.body;

    // ADD THIS DEBUG LOG
    console.log("Booking Request Body:", {
      equipment_id,
      booking_date,
      start_time,
      end_time,
      purpose,
      userId,
    });

    // Validation
    if (!equipment_id || !booking_date || !start_time || !end_time) {
      console.log("Validation failed: Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
        received: { equipment_id, booking_date, start_time, end_time },
      });
    }

    // Check if equipment exists and is available
    const [equipment] = await db.query(
      'SELECT * FROM equipment WHERE id = ? AND status = "available"',
      [equipment_id]
    );

    if (equipment.length === 0) {
      console.log("Equipment not found or not available:", equipment_id);
      return res.status(404).json({
        success: false,
        message: "Equipment not found or not available",
      });
    }

    // Check for overlapping bookings
    const [overlapping] = await db.query(
      `SELECT * FROM bookings
      WHERE equipment_id = ?
      AND booking_date = ?
      AND status IN ('pending', 'approved')
      AND (
        (start_time < ? AND end_time > ?) OR
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND end_time <= ?)
      )`,
      [
        equipment_id,
        booking_date,
        end_time,
        start_time,
        end_time,
        start_time,
        start_time,
        end_time,
      ]
    );

    if (overlapping.length > 0) {
      console.log("Time slot already booked:", overlapping);
      return res.status(400).json({
        success: false,
        message: "This time slot is already booked",
      });
    }

    // Create booking
    const [result] = await db.query(
      "INSERT INTO bookings (user_id, equipment_id, booking_date, start_time, end_time, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        equipment_id,
        booking_date,
        start_time,
        end_time,
        purpose,
        "pending",
      ]
    );

    console.log("Booking created successfully:", result.insertId);

    // Create lab logbook entry
    const [user] = await db.query("SELECT name FROM users WHERE id = ?", [
      userId,
    ]);
    await db.query(
      "INSERT INTO lab_logbook (user_id, activity_type, equipment_id, booking_id, description) VALUES (?, ?, ?, ?, ?)",
      [
        userId,
        "booking_created",
        equipment_id,
        result.insertId,
        `${user[0].name} created a booking for ${equipment[0].name}`,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Booking created successfully. Waiting for approval.",
      bookingId: result.insertId,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get user's bookingsexports.validateBooking
exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [bookings] = await db.query(
      `SELECT b.*, e.name as equipment_name, e.type as equipment_type
       FROM bookings b
       JOIN equipment e ON b.equipment_id = e.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.start_time DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM bookings WHERE user_id = ?",
      [userId]
    );

    res.json({
      success: true,
      count: bookings.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all bookings (Admin)
exports.getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT b.*,
        u.name as user_name,
        u.email as user_email,
        e.name as equipment_name,
        e.type as equipment_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN equipment e ON b.equipment_id = e.id
    `;

    const params = [];

    if (status) {
      query += " WHERE b.status = ?";
      params.push(status);
    }

    query +=
      " ORDER BY b.booking_date DESC, b.start_time DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [bookings] = await db.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) as total FROM bookings";
    const countParams = [];
    if (status) {
      countQuery += " WHERE status = ?";
      countParams.push(status);
    }

    const [countResult] = await db.query(countQuery, countParams);

    res.json({
      success: true,
      count: bookings.length,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit),
      currentPage: parseInt(page),
      bookings,
    });
  } catch (error) {
    console.error("Get all bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Approve booking (Admin)
exports.approveBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.userId;
    const { remarks } = req.body;

    // Check if booking exists
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND status = "pending"',
      [id]
    );

    if (booking.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or already processed",
      });
    }

    // Update booking status
    await db.query(
      "UPDATE bookings SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ? WHERE id = ?",
      ["approved", adminId, remarks, id]
    );

    // Create notification for user
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type, related_booking_id) VALUES (?, ?, ?, ?, ?)",
      [
        booking[0].user_id,
        "Booking Approved",
        `Your booking has been approved. ${remarks || ""}`,
        "approval",
        id,
      ]
    );

    // Create lab logbook entry
    const [admin] = await db.query("SELECT name FROM users WHERE id = ?", [
      adminId,
    ]);
    const [equipment] = await db.query(
      "SELECT name FROM equipment WHERE id = ?",
      [booking[0].equipment_id]
    );
    await db.query(
      "INSERT INTO lab_logbook (user_id, activity_type, equipment_id, booking_id, description) VALUES (?, ?, ?, ?, ?)",
      [
        adminId,
        "booking_approved",
        booking[0].equipment_id,
        id,
        `${admin[0].name} approved booking for ${equipment[0].name}`,
      ]
    );

    res.json({
      success: true,
      message: "Booking approved successfully",
    });
  } catch (error) {
    console.error("Approve booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Reject booking (Admin)
exports.rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.userId;
    const { remarks } = req.body;

    // Check if booking exists
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND status = "pending"',
      [id]
    );

    if (booking.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or already processed",
      });
    }

    // Update booking status
    await db.query(
      "UPDATE bookings SET status = ?, approved_by = ?, approved_at = NOW(), remarks = ? WHERE id = ?",
      ["rejected", adminId, remarks, id]
    );

    // Create notification for user
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type, related_booking_id) VALUES (?, ?, ?, ?, ?)",
      [
        booking[0].user_id,
        "Booking Rejected",
        `Your booking has been rejected. Reason: ${remarks || "Not specified"}`,
        "rejection",
        id,
      ]
    );

    // Create lab logbook entry
    const [admin] = await db.query("SELECT name FROM users WHERE id = ?", [
      adminId,
    ]);
    const [equipment] = await db.query(
      "SELECT name FROM equipment WHERE id = ?",
      [booking[0].equipment_id]
    );
    await db.query(
      "INSERT INTO lab_logbook (user_id, activity_type, equipment_id, booking_id, description) VALUES (?, ?, ?, ?, ?)",
      [
        adminId,
        "booking_rejected",
        booking[0].equipment_id,
        id,
        `${admin[0].name} rejected booking for ${equipment[0].name}`,
      ]
    );

    res.json({
      success: true,
      message: "Booking rejected",
    });
  } catch (error) {
    console.error("Reject booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Cancel booking (User)
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if booking exists and belongs to user
    const [booking] = await db.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ? AND status = "pending"',
      [id, userId]
    );

    if (booking.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be cancelled",
      });
    }

    // Update booking status
    await db.query('UPDATE bookings SET status = "cancelled" WHERE id = ?', [
      id,
    ]);

    res.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
