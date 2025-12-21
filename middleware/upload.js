const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
const userImagesDir = './uploads/users';
const equipmentImagesDir = './uploads/equipment';

[uploadDir, userImagesDir, equipmentImagesDir].forEach(dir => {
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
    const uniqueName = `user_${req.userId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage configuration for equipment images
const equipmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, equipmentImagesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: equipment_timestamp.extension
    const uniqueName = `equipment_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to allow only images
const imageFilter = function (req, file, cb) {
  // Accept only image files
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Upload middleware for user profile images
const uploadUserImage = multer({
  storage: userStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: imageFilter
}).single('profile_image'); // Field name in form data

// Upload middleware for equipment images
const uploadEquipmentImage = multer({
  storage: equipmentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: imageFilter
}).single('equipment_image'); // Field name in form data

// Helper function to delete old image file
const deleteImageFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  uploadUserImage,
  uploadEquipmentImage,
  deleteImageFile
};