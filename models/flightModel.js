// 1. First, let's fix the Flight Schema
const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: {
    type: String,
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true
  },
  airline: {
    code: {
      type: String,
      required: true
    },
    name: String,
    marketingCarrier: String,
    operatingCarrier: String
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
        type: String
      }]
    }
  },
  aircraft: {
    type: {
      type: String
    },
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
    fareBasicCode: String
  },
  availability: {
    refundable: Boolean,
    hold: Boolean
  },
  inclusions: {
    baggage: String
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