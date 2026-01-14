const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activity.controller");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { validatePagination } = require("../middleware/validation");

// User routes
router.get("/notifications", verifyToken, activityController.getNotifications);
router.put(
  "/notifications/:id/read",
  verifyToken,
  activityController.markNotificationRead
);
router.post("/print-logs", verifyToken, activityController.addPrintLog);
router.get("/my-print-logs", verifyToken, activityController.getMyPrintLogs);
router.post("/sign-out", verifyToken, activityController.autoSignOut);
// Admin routes
router.get("/all", verifyToken, isAdmin, activityController.getAllActivity);
router.get("/logbook", verifyToken, isAdmin, activityController.getLabLogbook);
router.post("/sign-in", verifyToken, activityController.signIn);
router.get(
  "/my-activity",
  verifyToken,
  validatePagination,
  activityController.getMyActivity
);
module.exports = router;
