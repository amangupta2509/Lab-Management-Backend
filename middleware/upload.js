const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = "./uploads";
const userImagesDir = "./uploads/users";
const equipmentImagesDir = "./uploads/equipment";

[uploadDir, userImagesDir, equipmentImagesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for user profile images
const userStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, userImagesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: user_userId_timestamp.extension
    const uniqueName = `user_${req.userId}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// Storage configuration for equipment images
const equipmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, equipmentImagesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: equipment_timestamp_random.extension
    // Added random string for extra uniqueness in case of simultaneous uploads
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueName = `equipment_${Date.now()}_${randomStr}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// File filter to allow only images
const imageFilter = function (req, file, cb) {
  // Accept only image files
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Upload middleware for user profile images
const uploadUserImage = multer({
  storage: userStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: imageFilter,
}).single("profile_image"); // Field name in form data

// Upload middleware for equipment images
const uploadEquipmentImage = multer({
  storage: equipmentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: imageFilter,
}).single("image"); // Field name in form data

// Helper function to delete old image file
const deleteImageFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✓ Deleted old image: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error deleting image file: ${filePath}`, error);
    return false;
  }
};

// Optional: Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field in file upload",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }

  next();
};

module.exports = {
  uploadUserImage,
  uploadEquipmentImage,
  deleteImageFile,
  handleMulterError, // Export the error handler
};
