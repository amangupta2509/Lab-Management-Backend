const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CONSTANTS = require("../config/constants");

// Create uploads directories if they don't exist
const directories = [
  CONSTANTS.UPLOAD.BASE_UPLOAD_DIR,
  CONSTANTS.UPLOAD.USER_IMAGES_DIR,
  CONSTANTS.UPLOAD.EQUIPMENT_IMAGES_DIR,
];

directories.forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }
});

// Storage configuration for user profile images
const userStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CONSTANTS.UPLOAD.USER_IMAGES_DIR);
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
    cb(null, CONSTANTS.UPLOAD.EQUIPMENT_IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with random string for extra uniqueness
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueName = `equipment_${Date.now()}_${randomStr}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// File filter to allow only images
const imageFilter = function (req, file, cb) {
  const extname = CONSTANTS.UPLOAD.ALLOWED_EXTENSIONS.includes(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = CONSTANTS.UPLOAD.ALLOWED_IMAGE_TYPES.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        `Only image files are allowed (${CONSTANTS.UPLOAD.ALLOWED_EXTENSIONS.join(
          ", "
        )})`
      )
    );
  }
};

// Upload middleware for user profile images
const uploadUserImage = multer({
  storage: userStorage,
  limits: {
    fileSize: CONSTANTS.UPLOAD.MAX_FILE_SIZE,
  },
  fileFilter: imageFilter,
}).single("profile_image");

// Upload middleware for equipment images
const uploadEquipmentImage = multer({
  storage: equipmentStorage,
  limits: {
    fileSize: CONSTANTS.UPLOAD.MAX_FILE_SIZE,
  },
  fileFilter: imageFilter,
}).single("image");

// Helper function to delete old image file
const deleteImageFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted old image: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting image file: ${filePath}`, error);
    return false;
  }
};

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size is ${
          CONSTANTS.UPLOAD.MAX_FILE_SIZE / (1024 * 1024)
        }MB`,
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

// Cleanup old files (optional - can be used in cron job)
const cleanupOldFiles = (directory, daysOld = 90) => {
  try {
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      console.log(`? Directory does not exist: ${directory}`);
      return 0;
    }

    const files = fs.readdirSync(directory);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(directory, file);

      if (!fs.statSync(filePath).isFile()) {
        return;
      }

      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    console.log(`? Cleaned up ${deletedCount} old files from ${directory}`);
    return deletedCount;
  } catch (error) {
    console.error(`? Error cleaning up files:`, error);
    return 0;
  }
};

module.exports = {
  uploadUserImage,
  uploadEquipmentImage,
  deleteImageFile,
  handleMulterError,
  cleanupOldFiles,
};
