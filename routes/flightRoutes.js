const express = require("express");
const router = express.Router();
const flightSearchController = require("../controllers/flight/searchController");
const flightPricingController = require('../controllers/flight/pricingController');
const flightItineraryController = require('../controllers/flight/itineraryController');
const retrieveBookingController = require("../controllers/flight/retrieveBookingController");
const seatLayoutController = require("../controllers/flight/seatLayoutController");
const ssrController  = require("../controllers/flight/ssrController");
const paymentController  = require("../controllers/flight/paymentController");
const { authGuard } = require("../middleware/authMiddleware");
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
  
//Route to get flight seat Layout
  router.get(
    '/layout',
    seatLayoutController.getSeatLayout
  );


  // Validation schemas
const ssrValidation = {
  params: {
    tui: {
      type: 'string',
      required: true,
      pattern: '^[0-9a-fA-F-]+$'
    },
    flightNumber: {
      type: 'string',
      required: true
    }
  },
  query: {
    source: {
      type: 'string',
      enum: ['LV', 'CF'],
      default: 'LV'
    },
    fareType: {
      type: 'string',
      enum: ['N', 'S'],
      default: 'N'
    }
  }
};

const validateSSRSchema = {
  params: ssrValidation.params,
  body: {
    ssrs: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        required: ['code', 'id'],
        properties: {
          code: { type: 'string' },
          id: { type: 'number' },
          amount: { type: 'number' },
          passengerIndex: { type: 'number' }
        }
      }
    }
  }
};
// Routes
router.get(
  '/ssr/:tui/:flightNumber',
  // authenticate,
  // validateRequest(ssrValidation),
  ssrController.getFlightSSR
);

router.post(
  '/ssr/validate/:tui/:flightNumber',
  // authenticate,
  validateRequest(validateSSRSchema),
  ssrController.validateSSRSelection
);


router.get("/search/:TUI", flightSearchController.getSearchResults);

router.get("/details/:flightId", flightSearchController.getFlightDetails);

router.get("/fare-rules", flightSearchController.getFareRules);

router.get("/seat-map", flightSearchController.getSeatMap);

router.get("/baggage-info", flightSearchController.getBaggageInfo);


module.exports = router;

