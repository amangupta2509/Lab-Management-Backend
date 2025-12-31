// routes/equipment.routes.js
const express = require("express");
const router = express.Router();
const equipmentController = require("../controllers/equipment.controller");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { uploadEquipmentImage } = require("../middleware/upload");
const {
  validateEquipment,
  validateId,
  validatePagination,
} = require("../middleware/validation");
const { uploadLimiter, sanitizeFileName } = require("../middleware/security");

router.get(
  "/",
  verifyToken,
  validatePagination,
  equipmentController.getAllEquipment
);
router.get(
  "/:id",
  verifyToken,
  validateId,
  equipmentController.getEquipmentById
);

router.post(
  "/",
  verifyToken,
  isAdmin,
  uploadEquipmentImage,
  sanitizeFileName,
  validateEquipment,
  equipmentController.addEquipment
);

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  validateId,
  uploadEquipmentImage,
  sanitizeFileName,
  validateEquipment,
  equipmentController.updateEquipment
);

router.delete(
  "/:id",
  verifyToken,
  isAdmin,
  validateId,
  equipmentController.deleteEquipment
);

router.post(
  "/:id/upload-image",
  verifyToken,
  isAdmin,
  validateId,
  uploadLimiter,
  uploadEquipmentImage,
  sanitizeFileName,
  equipmentController.uploadEquipmentImage
);

router.delete(
  "/:id/delete-image",
  verifyToken,
  isAdmin,
  validateId,
  equipmentController.deleteEquipmentImage
);
router.get(
  "/:id/analytics",
  verifyToken,
  isAdmin,
  validateId,
  equipmentController.getEquipmentAnalytics
);
module.exports = router;
