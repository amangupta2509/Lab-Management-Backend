const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth');
const { uploadUserImage } = require('../middleware/upload');

// All routes require authentication
router.use(verifyToken);

// User profile routes
router.get('/profile', userController.getMyProfile);
router.put('/profile', userController.updateProfile);
router.put('/change-password', userController.changePassword);

// Profile image routes
router.post('/upload-image', uploadUserImage, userController.uploadProfileImage);
router.delete('/delete-image', userController.deleteProfileImage);

// Dashboard & Reports
router.get('/dashboard', userController.getDashboard);
router.get('/productivity-report', userController.getMyProductivityReport);

module.exports = router;