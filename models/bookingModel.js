const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
      },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['ONE_WAY', 'ROUND_TRIP', 'MULTI_CITY'],
      required: true
    },
    status: {
      type: String,
      enum: ['INITIATED', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUNDED'],
      default: 'INITIATED'
    },
    flights: [{
      flightId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flight'
      },
      flightNumber: String,
      tui: String,
      provider: {
        code: String,
        pnr: String
      },
      departure: {
        airport: {
          code: String,
          name: String,
          city: String,
          terminal: String
        },
        scheduledTime: Date,
        gate: String
      },
      arrival: {
        airport: {
          code: String,
          name: String,
          city: String,
          terminal: String
        },
        scheduledTime: Date,
        gate: String
      },
      cabin: {
        type: String,
        fareType: String,
        baggage: {
          cabin: {
            weight: Number,
            unit: String
          },
          checked: {
            weight: Number,
            unit: String
          }
        }
      }
    }],
    passengers: [{
      type: {
        type: String,
        enum: ['ADT', 'CHD', 'INF'],
        required: true
      },
      title: {
        type: String,
        enum: ['MR', 'MRS', 'MS', 'MSTR', 'MISS']
      },
      firstName: {
        type: String,
        required: true
      },
      lastName: {
        type: String,
        required: true
      },
      dateOfBirth: Date,
      nationality: String,
      documents: [{
        type: {
          type: String,
          enum: ['PASSPORT', 'ID_CARD']
        },
        number: String,
        issuingCountry: String,
        expiryDate: Date
      }],
      seats: [{
        flightNumber: String,
        seatNumber: String
      }],
      services: [{
        type: {
          type: String,
          enum: ['MEAL', 'BAGGAGE', 'SEAT', 'LOUNGE']
        },
        details: String,
        price: Number
      }]
    }],
    contact: {
      email: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      },
      alternatePhone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        country: String,
        postalCode: String
      }
    },
    pricing: {
      currency: {
        type: String,
        required: true
      },
      breakdown: {
        baseFare: Number,
        taxes: [{
          code: String,
          description: String,
          amount: Number
        }],
        fees: [{
          type: String,
          description: String,
          amount: Number
        }],
        addons: [{
          type: String,
          description: String,
          amount: Number
        }],
        discounts: [{
          code: String,
          description: String,
          amount: Number
        }]
      },
      totalAmount: {
        type: Number,
        required: true
      }
    },
    payment: {
      status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']
      },
      method: {
        type: String,
        enum: ['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI', 'WALLET']
      },
      transactions: [{
        id: String,
        gateway: String,
        amount: Number,
        currency: String,
        status: String,
        timestamp: Date,
        metadata: Object
      }]
    },
    ancillaries: {
      seats: [{
        flightNumber: String,
        passenger: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Passenger'
        },
        seatNumber: String,
        price: Number
      }],
      meals: [{
        flightNumber: String,
        passenger: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Passenger'
        },
        mealType: String,
        price: Number
      }],
      baggage: [{
        flightNumber: String,
        passenger: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Passenger'
        },
        weight: Number,
        price: Number
      }]
    },
    history: [{
      status: String,
      timestamp: Date,
      agent: String,
      remarks: String
    }],
    documents: [{
      type: {
        type: String,
        enum: ['TICKET', 'INVOICE', 'RECEIPT', 'ITINERARY']
      },
      url: String,
      generatedAt: Date
    }],
    meta: {
      source: {
        type: String,
        enum: ['WEB', 'MOBILE', 'API', 'ADMIN']
      },
      ip: String,
      userAgent: String,
      sessionId: String
    }
  }, {
    timestamps: true
  });
  
  // Generate booking reference
  bookingSchema.pre('save', async function(next) {
    if (!this.bookingReference) {
      const prefix = 'FB';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      this.bookingReference = `${prefix}${timestamp}${random}`;
    }
    next();
  });
  
  module.exports = mongoose.model('Booking', bookingSchema);
  