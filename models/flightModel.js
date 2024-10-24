const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: {
    type: String,
    required: true,
    index: true
  },
  provider: {
    type: String,  // Added for tracking the data provider
    required: true
  },
  airline: {
    code: {
      type: String,
      required: true
    },
    name: String,
    marketingCarrier: String,    // Marketing carrier code
    operatingCarrier: String     // Operating carrier code
  },
  route: {
    departure: {
      airport: {
        code: {
          type: String,
          required: true
        },
        name: String,
        location: String
      },
      terminal: String,
      scheduledTime: {
        type: Date,
        required: true
      }
    },
    arrival: {
      airport: {
        code: {
          type: String,
          required: true
        },
        name: String,
        location: String
      },
      terminal: String,
      scheduledTime: {
        type: Date,
        required: true
      }
    },
    duration: String,
    stops: {
      count: Number,
      connections: [{
        airport: {
          code: String,
          name: String,
          location: String
        },
        duration: String,
        type: String  // Connection type (e.g., 'C' for connection, 'H' for halt)
      }]
    }
  },
  aircraft: {
    type: String,
    code: String,
    fareClass: String,
    cabin: String
  },
  pricing: {
    currency: {
      type: String,
      required: true
    },
    gross: {
      type: Number,
      required: true
    },
    net: Number,
    commission: Number,
    transactionFee: Number,
    vatOnFee: Number,
    wpNet: Number,
    fareBasicCode: String,
    fareType: String,
    trendFare: Number,
    promo: String
  },
  availability: {
    seats: Number,
    refundable: Boolean,
    hold: Boolean,
    holdInfo: String
  },
  amenities: [String],
  inclusions: {
    baggage: String,
    meals: String,
    pieceDescription: String
  },
  notices: [{
    message: String,
    link: String,
    type: String
  }],
  grouping: {
    returnIdentifier: Number,
    groupCount: Number,
    journeyKey: String,
    index: String
  },
  meta: {
    gfl: Boolean,
    recommended: Boolean,
    gsdPriority: Number,
    isBusStation: Boolean,
    channelCode: String
  }
}, {
  timestamps: true
});

// Add indexes for common search patterns
flightSchema.index({ 'airline.code': 1, flightNumber: 1 });
flightSchema.index({ 'route.departure.airport.code': 1, 'route.departure.scheduledTime': 1 });
flightSchema.index({ 'route.arrival.airport.code': 1, 'route.arrival.scheduledTime': 1 });
flightSchema.index({ 'pricing.gross': 1 });
flightSchema.index({ 'availability.seats': 1 });
flightSchema.index({ 'pricing.fareType': 1 });

  module.exports = mongoose.model('Flight', flightSchema);