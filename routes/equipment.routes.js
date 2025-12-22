// routes/equipment.routes.js
const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipment.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { uploadEquipmentImage } = require('../middleware/upload');
const { validateEquipment, validateId, validatePagination } = require('../middleware/validation');
const { uploadLimiter, sanitizeFileName } = require('../middleware/security');

// Public routes (authenticated users)
router.get('/', verifyToken, validatePagination, equipmentController.getAllEquipment);
router.get('/:id', verifyToken, validateId, equipmentController.getEquipmentById);

// Admin only routes
router.post('/', verifyToken, isAdmin, uploadEquipmentImage, sanitizeFileName, validateEquipment, equipmentController.addEquipment);
router.put('/:id', verifyToken, isAdmin, validateId, validateEquipment, equipmentController.updateEquipment);
router.delete('/:id', verifyToken, isAdmin, validateId, equipmentController.deleteEquipment);

// Equipment image routes (Admin only)
router.post('/:id/upload-image', verifyToken, isAdmin, validateId, uploadLimiter, uploadEquipmentImage, sanitizeFileName, equipmentController.uploadEquipmentImage);
router.delete('/:id/delete-image', verifyToken, isAdmin, validateId, equipmentController.deleteEquipmentImage);

module.exports = router;