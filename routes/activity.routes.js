const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');

// User routes
router.get('/my-activity', verifyToken, activityController.getMyActivity);
router.get('/notifications', verifyToken, activityController.getNotifications);
router.put('/notifications/:id/read', verifyToken, activityController.markNotificationRead);
router.post('/print-logs', verifyToken, activityController.addPrintLog);
router.get('/my-print-logs', verifyToken, activityController.getMyPrintLogs);

// Admin routes
router.get('/all', verifyToken, isAdmin, activityController.getAllActivity);
router.get('/logbook', verifyToken, isAdmin, activityController.getLabLogbook);

module.exports = router;