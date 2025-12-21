const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { validateBooking, validateId, validatePagination } = require('../middleware/validation');
const { bookingLimiter } = require('../middleware/security');

// User routes
router.post('/', verifyToken, bookingLimiter, validateBooking, bookingController.createBooking);
router.get('/my-bookings', verifyToken, validatePagination, bookingController.getMyBookings);
router.put('/:id/cancel', verifyToken, validateId, bookingController.cancelBooking);

// Admin routes
router.get('/', verifyToken, isAdmin, validatePagination, bookingController.getAllBookings);
router.put('/:id/approve', verifyToken, isAdmin, validateId, bookingController.approveBooking);
router.put('/:id/reject', verifyToken, isAdmin, validateId, bookingController.rejectBooking);

module.exports = router;