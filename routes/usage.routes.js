const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usage.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');

// User routes
router.post('/start', verifyToken, usageController.startSession);
router.post('/end', verifyToken, usageController.endSession);
router.get('/my-sessions', verifyToken, usageController.getMySessions);

// Admin routes
router.get('/', verifyToken, isAdmin, usageController.getAllSessions);
router.get('/equipment/:equipment_id', verifyToken, isAdmin, usageController.getSessionsByEquipment);

module.exports = router;