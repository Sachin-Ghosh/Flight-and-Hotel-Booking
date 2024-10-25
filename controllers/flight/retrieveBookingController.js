// controllers/flight/retrieveBookingController.js
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const Flight = require('../../models/flightModel');
const axios = require('axios');

const logger = createLogger('RetrieveBookingController');

class RetrieveBookingController {
  constructor() {
    this.getBooking = this.getBooking.bind(this);
    this._validateRequest = this._validateRequest.bind(this);
    this._makeRequest = this._makeRequest.bind(this);
  }

  async getBooking(req, res, next) {
    try {
      // Validate request
      this._validateRequest(req.body);

      const { clientId, token } = await signatureService.getCredentials();

      // Prepare request payload
      const payload = {
        ...req.body,
        ClientID: clientId,
        ServiceType: req.body.ServiceType || 'FLT'
      };

      // Make request to retrieve booking
      const response = await this._makeRequest(
        'POST',
        `${BENZY_CONFIG.baseUrls.flights}/Utils/RetrieveBooking`,
        payload,
        token
      );

      // Format the response
      const formattedResponse = {
        success: true,
        data: {
          transactionId: response.TransactionID,
          bookingStatus: response.Status,
          paymentStatus: response.PaymentStatus,
          flightDetails: response.Trips?.[0]?.Journey?.[0]?.Segments?.map(segment => ({
            airline: segment.Flight.Airline,
            flightNumber: segment.Flight.FlightNo,
            departure: {
              airport: segment.Flight.DepAirportName,
              terminal: segment.Flight.DepartureTerminal,
              time: segment.Flight.DepartureTime
            },
            arrival: {
              airport: segment.Flight.ArrAirportName,
              terminal: segment.Flight.ArrivalTerminal,
              time: segment.Flight.ArrivalTime
            },
            duration: segment.Flight.Duration
          })),
          passengers: response.Pax?.map(passenger => ({
            title: passenger.Title,
            firstName: passenger.FName,
            lastName: passenger.LName,
            paxType: passenger.PTC
          })),
          pricing: {
            currency: 'INR',
            baseAmount: response.AirlineNetFare,
            taxes: response.Trips?.[0]?.Journey?.[0]?.Segments?.[0]?.Fares?.TotalTax || 0,
            totalAmount: response.GrossAmount
          }
        }
      };

      return res.status(200).json(formattedResponse);

    } catch (error) {
      logger.error('Booking retrieval error:', error);
      next(error);
    }
  }

  _validateRequest(body) {
    const requiredFields = {
      ReferenceType: 'Reference type is required',
      ReferenceNumber: 'Reference number is required'
    };

    const errors = [];

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!body[field]) {
        errors.push(message);
      }
    }

    if (errors.length > 0) {
      throw new ApiError(400, 'Validation failed', { errors });
    }
  }

  async _makeRequest(method, url, data, token) {
    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.Code !== '200') {
        throw new ApiError(400, response.data.Msg?.[0] || 'Booking retrieval failed');
      }

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          error.response?.status || 500,
          error.response?.data?.Msg?.[0] || 'Booking retrieval failed',
          error
        );
      }
      throw error;
    }
  }
}

// Export a single instance
const retrieveBookingController = new RetrieveBookingController();
module.exports = retrieveBookingController;