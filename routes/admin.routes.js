// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes are admin only
router.use(verifyToken, isAdmin);

// Dashboard & Analytics
router.get('/dashboard', adminController.getDashboardStats);
router.get('/equipment-utilization', adminController.getEquipmentUtilization);
router.get('/user-productivity', adminController.getUserProductivity);
router.get('/booking-analytics', adminController.getBookingAnalytics);

router.get('/machine-analytics', adminController.getMachineUtilizationAnalytics);
router.get('/daily-patterns', adminController.getDailyUsagePatterns);
router.get('/peak-hours', adminController.getPeakHoursAnalysis);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id/details', adminController.getUserDetails);
router.put('/users/:id/toggle-status', adminController.toggleUserStatus);

module.exports = router;