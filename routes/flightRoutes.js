const express = require("express");
const router = express.Router();
const flightSearchController = require("../controllers/flight/searchController");
const flightPricingController = require('../controllers/flight/pricingController');
// const flightBookingController = require("../controllers/flight/bookingController");
// const flightPaymentController = require("../controllers/flight/paymentController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { validateRequest } = require("../middleware/validationMiddleware");

// Search Routes
router.post("/search",
  flightSearchController.searchFlights
);

// Get final live pricing in a single request
router.post('/pricing/live',
    
    flightPricingController.getLivePrice
  );

router.get("/search/:TUI", flightSearchController.getSearchResults);

router.get("/details/:flightId", flightSearchController.getFlightDetails);

router.get("/fare-rules", flightSearchController.getFareRules);

router.get("/seat-map", flightSearchController.getSeatMap);

router.get("/baggage-info", flightSearchController.getBaggageInfo);

// // Booking Routes (Protected with auth)
// router.post(
//   "/booking/create",
//   authMiddleware,
//   validateRequest("flightBooking"),
//   flightBookingController.createBooking
// );

// router.get(
//   "/booking/:bookingId",
//   authMiddleware,
//   flightBookingController.getBookingDetails
// );

// router.post(
//   "/booking/:bookingId/cancel",
//   authMiddleware,
//   flightBookingController.cancelBooking
// );

// router.get(
//   "/booking/history",
//   authMiddleware,
//   flightBookingController.getBookingHistory
// );

// // Payment Routes (Protected with auth)
// router.post(
//   "/payment/initiate",
//   authMiddleware,
//   validateRequest("paymentInitiate"),
//   flightPaymentController.initiatePayment
// );

// router.post(
//   "/payment/verify",
//   authMiddleware,
//   flightPaymentController.verifyPayment
// );

// router.post(
//   "/payment/refund",
//   authMiddleware,
//   flightPaymentController.initiateRefund
// );

// router.get(
//   "/payment/:paymentId",
//   authMiddleware,
//   flightPaymentController.getPaymentDetails
// );

module.exports = router;

