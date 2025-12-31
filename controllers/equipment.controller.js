const db = require("../config/database");
const { deleteImageFile } = require("../middleware/upload");
const path = require("path");

// Get all equipment (excluding deleted)
exports.getAllEquipment = async (req, res) => {
  try {
    const [equipment] = await db.query(
      'SELECT * FROM equipment WHERE status != "deleted" ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      count: equipment.length,
      equipment,
    });
  } catch (error) {
    console.error("Get equipment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get single equipment by ID
exports.getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [equipment] = await db.query(
      'SELECT * FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    res.json({
      success: true,
      equipment: equipment[0],
    });
  } catch (error) {
    console.error("Get equipment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getEquipmentAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 30;

    // Check if equipment exists
    const [equipment] = await db.query(
      'SELECT * FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Get total usage statistics
    const [usageStats] = await db.query(
      `SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_hours,
        COUNT(DISTINCT user_id) as unique_users
      FROM equipment_usage_sessions
      WHERE equipment_id = ?
      AND start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [id, days]
    );

    // Get usage by user
    const [userUsage] = await db.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(eus.id) as session_count,
        COALESCE(SUM(eus.duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(eus.duration_minutes) / 60, 2), 0) as total_hours,
        MAX(eus.start_time) as last_used
      FROM equipment_usage_sessions eus
      JOIN users u ON eus.user_id = u.id
      WHERE eus.equipment_id = ?
      AND eus.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY u.id
      ORDER BY total_hours DESC`,
      [id, days]
    );

    // Get recent sessions
    const [recentSessions] = await db.query(
      `SELECT 
        eus.*,
        u.name as user_name,
        u.email as user_email,
        b.booking_date
      FROM equipment_usage_sessions eus
      JOIN users u ON eus.user_id = u.id
      JOIN bookings b ON eus.booking_id = b.id
      WHERE eus.equipment_id = ?
      ORDER BY eus.start_time DESC
      LIMIT 10`,
      [id]
    );

    // Get booking statistics
    const [bookingStats] = await db.query(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_bookings,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings
      FROM bookings
      WHERE equipment_id = ?
      AND booking_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [id, days]
    );

    res.json({
      success: true,
      equipment: equipment[0],
      period_days: days,
      usage: usageStats[0],
      userUsage,
      recentSessions,
      bookings: bookingStats[0],
    });
  } catch (error) {
    console.error("Get equipment analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Add new equipment (Admin only)
exports.addEquipment = async (req, res) => {
  try {
    const { name, type, description, model_number, serial_number } = req.body;
    const createdBy = req.userId;

    // Validation
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Please provide equipment name and type",
      });
    }

    // Get image path if uploaded
    const imagePath = req.file
      ? `uploads/equipment/${req.file.filename}`
      : null;

    const [result] = await db.query(
      "INSERT INTO equipment (name, type, description, model_number, serial_number, equipment_image, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        type,
        description,
        model_number,
        serial_number,
        imagePath,
        createdBy,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Equipment added successfully",
      equipmentId: result.insertId,
      imagePath: imagePath,
      imageUrl: imagePath
        ? `${req.protocol}://${req.get("host")}/${imagePath}`
        : null,
    });
  } catch (error) {
    console.error("Add equipment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update equipment (Admin only) - NOW WITH IMAGE SUPPORT
exports.updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, model_number, serial_number, status } =
      req.body;

    // Check if equipment exists
    const [existing] = await db.query(
      'SELECT * FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Handle image update if new image is uploaded
    let imagePath = existing[0].equipment_image; // Keep existing image by default

    if (req.file) {
      // Delete old image if exists
      if (existing[0].equipment_image) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          existing[0].equipment_image
        );
        deleteImageFile(oldImagePath);
      }
      // Set new image path
      imagePath = `uploads/equipment/${req.file.filename}`;
    }

    // Update equipment with all fields including image
    await db.query(
      "UPDATE equipment SET name = ?, type = ?, description = ?, model_number = ?, serial_number = ?, status = ?, equipment_image = ? WHERE id = ?",
      [
        name,
        type,
        description,
        model_number,
        serial_number,
        status,
        imagePath,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Equipment updated successfully",
      imagePath: imagePath,
      imageUrl: imagePath
        ? `${req.protocol}://${req.get("host")}/${imagePath}`
        : null,
    });
  } catch (error) {
    console.error("Update equipment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Upload/Update equipment image (Admin only)
exports.uploadEquipmentImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Check if equipment exists
    const [equipment] = await db.query(
      'SELECT equipment_image FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Delete old image if exists
    if (equipment[0].equipment_image) {
      const oldImagePath = path.join(
        __dirname,
        "..",
        equipment[0].equipment_image
      );
      deleteImageFile(oldImagePath);
    }

    // Save new image path to database
    const imagePath = `uploads/equipment/${req.file.filename}`;
    await db.query("UPDATE equipment SET equipment_image = ? WHERE id = ?", [
      imagePath,
      id,
    ]);

    res.json({
      success: true,
      message: "Equipment image uploaded successfully",
      imagePath: imagePath,
      imageUrl: `${req.protocol}://${req.get("host")}/${imagePath}`,
    });
  } catch (error) {
    console.error("Upload equipment image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete equipment image (Admin only)
exports.deleteEquipmentImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current image path
    const [equipment] = await db.query(
      'SELECT equipment_image FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    if (!equipment[0].equipment_image) {
      return res.status(400).json({
        success: false,
        message: "No equipment image to delete",
      });
    }

    // Delete image file
    const imagePath = path.join(__dirname, "..", equipment[0].equipment_image);
    deleteImageFile(imagePath);

    // Update database
    await db.query("UPDATE equipment SET equipment_image = NULL WHERE id = ?", [
      id,
    ]);

    res.json({
      success: true,
      message: "Equipment image deleted successfully",
    });
  } catch (error) {
    console.error("Delete equipment image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete equipment (Admin only)
exports.deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if equipment exists
    const [existing] = await db.query(
      'SELECT * FROM equipment WHERE id = ? AND status != "deleted"',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Soft delete - change status to deleted
    await db.query('UPDATE equipment SET status = "deleted" WHERE id = ?', [
      id,
    ]);

    res.json({
      success: true,
      message: "Equipment deleted successfully",
    });
  } catch (error) {
    console.error("Delete equipment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
