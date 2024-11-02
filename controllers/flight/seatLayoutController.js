// controllers/flight/seatLayoutController.js
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const cacheService = require('../../services/cacheService');
const axios = require('axios');

const logger = createLogger('SeatLayoutController');

class SeatLayoutController {
  constructor() {
    this.getSeatLayout = this.getSeatLayout.bind(this);
    // this._validateRequest = this._validateRequest.bind(this);
    this._formatSeatLayout = this._formatSeatLayout.bind(this);
  }

  async getSeatLayout(req, res, next) {
    try {
      const { tui, orderId, amount } = req.body;
      
    //   this._validateRequest(req.query);

      const { clientId, token } = await signatureService.getCredentials();

      const payload = {
        ClientID: clientId,
        Source: "LV",
        Trips: [{
          TUI: tui,
          Index: "",
          OrderID: parseInt(orderId),
          Amount: parseFloat(amount)
        }]
      };
    //   console.log(payload)

      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flights/SeatLayout`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data || !response.data.Trips) {
        throw new ApiError(404, 'Seat layout not available');
      }

      // Format seat layout data for frontend
      const formattedLayout = this._formatSeatLayout(response.data);

      // Cache the seat layout data for 15 minutes using the singleton instance
      const cacheKey = `seat-layout:${tui}`;
      const cacheDuration = 15 * 60; // 15 minutes
      await cacheService.set(cacheKey, formattedLayout, cacheDuration);


      return res.status(200).json({
        success: true,
        data: formattedLayout
      });

    } catch (error) {
      logger.error('Error fetching seat layout:', error);
      next(error);
    }
  }

//   _validateRequest(query) {
//     const requiredFields = {
//       tui: 'Transaction Unique Identifier is required',
//       orderId: 'Order ID is required',
//       amount: 'Amount is required'
//     };

//     const errors = [];

//     for (const [field, message] of Object.entries(requiredFields)) {
//       if (!query[field]) {
//         errors.push(message);
//       }
//     }

//     if (errors.length > 0) {
//       throw new ApiError(400, 'Validation failed', { errors });
//     }
//   }

  _formatSeatLayout(rawData) {
    const formattedData = {
      tui: rawData.TUI,
      flights: []
    };

    rawData.Trips.forEach(trip => {
      trip.Journey.forEach(journey => {
        journey.Segments.forEach(segment => {
          const flightLayout = {
            flightNumber: segment.FlightNo,
            aircraft: {
              name: segment.AirlineName,
              unit: segment.AirlineUnit
            },
            provider: journey.Provider,
            seatMap: {
              rows: [],
              legend: this._generateSeatLegend(segment.Seats)
            }
          };

          // Group seats by row
          const seatsByRow = {};
          segment.Seats.forEach(seat => {
            const rowNum = seat.SeatNumber.replace(/[A-Z]/g, '');
            if (!seatsByRow[rowNum]) {
              seatsByRow[rowNum] = [];
            }
            seatsByRow[rowNum].push({
              number: seat.SeatNumber,
              status: seat.SeatStatus,
              type: seat.SeatType || 'STANDARD',
              features: seat.SeatInfo.split('|'),
              available: seat.AvailStatus,
              pricing: {
                amount: parseFloat(seat.Fare),
                tax: parseFloat(seat.Tax),
                total: parseFloat(seat.SSRNetAmount),
                currency: 'INR'
              },
              position: {
                x: parseInt(seat.XValue),
                y: parseInt(seat.YValue)
              },
              restrictions: this._getSeatRestrictions(seat),
              ssrCode: seat.SSID.toString()
            });
          });

          // Sort rows and seats within rows
          Object.keys(seatsByRow)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(rowNum => {
              flightLayout.seatMap.rows.push({
                rowNumber: parseInt(rowNum),
                seats: seatsByRow[rowNum].sort((a, b) => 
                  a.number.localeCompare(b.number)
                )
              });
            });

          formattedData.flights.push(flightLayout);
        });
      });
    });

    return formattedData;
  }

  _generateSeatLegend(seats) {
    const legend = new Set();
    seats.forEach(seat => {
      if (seat.SeatType) legend.add(seat.SeatType);
      if (seat.SeatInfo) {
        seat.SeatInfo.split('|').forEach(info => legend.add(info));
      }
    });

    return Array.from(legend).map(type => ({
      code: type,
      description: this._getSeatTypeDescription(type)
    }));
  }

  _getSeatTypeDescription(type) {
    const descriptions = {
      'PS': 'Preferred Seat',
      'PRS': 'Premium Seat',
      'FS': 'Free Seat',
      'EES': 'Emergency Exit Seat',
      'SS': 'Standard Seat',
      'SM': 'SpiceMax Seat',
      'WINDOW': 'Window Seat',
      'AISLE': 'Aisle Seat',
      'MIDDLE': 'Middle Seat',
      'ALL': 'Available for All Passengers'
    };
    return descriptions[type] || type;
  }

  _getSeatRestrictions(seat) {
    const restrictions = [];
    
    if (seat.SeatInfo.includes('EES')) {
      restrictions.push({
        type: 'AGE',
        message: 'Must be at least 15 years old'
      });
    }

    if (seat.SeatStatus === 'Restricted') {
      restrictions.push({
        type: 'BOOKING_CLASS',
        message: 'Only available for specific booking classes'
      });
    }

    return restrictions;
  }
}

module.exports = new SeatLayoutController();