const express = require("express");
const router = express.Router();
const flightSearchController = require("../controllers/flight/searchController");
const flightPricingController = require('../controllers/flight/pricingController');
const flightItineraryController = require('../controllers/flight/itineraryController');
const retrieveBookingController = require("../controllers/flight/retrieveBookingController");
const paymentController  = require("../controllers/flight/paymentController");
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
  router.post('/itinerary/create', flightItineraryController.createItinerary);
  router.post('/booking/retrieve', retrieveBookingController.getBooking);

  // Route to initiate payment for a booking
router.post('/bookings/:bookingId/payments',
    paymentController.initiatePayment
  );
  
  // Route to handle payment callbacks
  router.post('/payments/callback/:transactionId',
    paymentController.handlePaymentCallback
  );
  
  // Route to handle payment redirects
  router.get('/payments/callback/:transactionId',
    paymentController.handlePaymentCallback
  );
  

router.get("/search/:TUI", flightSearchController.getSearchResults);

router.get("/details/:flightId", flightSearchController.getFlightDetails);

router.get("/fare-rules", flightSearchController.getFareRules);

router.get("/seat-map", flightSearchController.getSeatMap);

router.get("/baggage-info", flightSearchController.getBaggageInfo);


module.exports = router;

