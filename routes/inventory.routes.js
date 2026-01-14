/**
 * Inventory Routes
 * Lab Management System
 *
 * All routes require authentication
 * Admin-only routes use isAdmin middleware
 */

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const inventory = require("../controllers/inventory.controller");

/* =====================================================
   LAB INVENTORY ROUTES
   ===================================================== */

// Create lab inventory item (Admin only)
router.post(
  "/lab",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.addLabInventoryItem
);

// Get all lab inventory items (Admin only)
router.get(
  "/lab",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getLabInventory
);

// Update lab inventory item (Admin only)
router.put(
  "/lab/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.updateLabInventory
);

// Delete lab inventory item (Admin only)
router.delete(
  "/lab/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.deleteLabInventory
);

/* =====================================================
   NGS INVENTORY ROUTES
   ===================================================== */

// Create NGS inventory item (Admin only)
router.post(
  "/ngs",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.addNgsInventoryItem
);

// Get all NGS inventory items (Admin only)
router.get(
  "/ngs",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getNgsInventory
);

// Update NGS inventory item (Admin only)
router.put(
  "/ngs/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.updateNgsInventory
);

// Delete NGS inventory item (Admin only)
router.delete(
  "/ngs/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.deleteNgsInventory
);

/* =====================================================
   STOCK TRANSACTIONS
   ===================================================== */

// Consume inventory (Admin only)
router.post(
  "/consume",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.consumeInventory
);

// Adjust inventory (Admin only)
router.post(
  "/adjust",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.adjustInventory
);

// Get transaction history (Admin only)
router.get(
  "/transactions",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getTransactions
);

/* =====================================================
   ALERTS
   ===================================================== */

// Get inventory alerts (Admin only)
router.get(
  "/alerts",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getInventoryAlerts
);

// Generate alerts (Admin only - can be called by cron)
router.post(
  "/generate-alerts",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.generateAlerts
);

// Resolve alert (Admin only)
router.put(
  "/alerts/:id/resolve",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.resolveAlert
);

/* =====================================================
   PROJECTS / SAMPLES
   ===================================================== */

// Create project (Admin only)
router.post(
  "/projects",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.createProject
);

// Get projects (Admin only)
router.get(
  "/projects",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getProjects
);

// Update project (Admin only)
router.put(
  "/projects/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.updateProject
);

// Delete project (Admin only)
router.delete(
  "/projects/:id",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.deleteProject
);

/* =====================================================
   RUN PLANS
   ===================================================== */

// Create run plan (Admin only)
router.post(
  "/runs",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.createRunPlan
);

// Get run plans (Admin only)
router.get(
  "/runs",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getRunPlans
);

/* =====================================================
   REPORTS & ANALYTICS
   ===================================================== */

// Get inventory summary report (Admin only)
router.get(
  "/report",
  auth.verifyToken,
  auth.isActive,
  auth.isAdmin,
  inventory.getInventoryReport
);

module.exports = router;
