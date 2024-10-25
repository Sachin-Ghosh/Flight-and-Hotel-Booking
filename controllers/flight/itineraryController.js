// controllers/flight/flightItineraryController.js
const mongoose = require('mongoose');
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const Flight = require('../../models/flightModel');
const Booking = require('../../models/bookingModel'); // Add this import
const axios = require('axios');

const logger = createLogger('FlightItineraryController');

class FlightItineraryController {
  constructor() {
    this.createItinerary = this.createItinerary.bind(this);
    this._validateRequest = this._validateRequest.bind(this);
    this._makeRequest = this._makeRequest.bind(this);
    this._saveFlightDetails = this._saveFlightDetails.bind(this);
    this._createBooking = this._createBooking.bind(this);
  }

  async createItinerary(req, res, next) {
    try {
      const { TUI, ContactInfo, Travellers, NetAmount } = req.body;
      const userId = req.user?._id; // Capture userId from request but don't include in payload
      
      // Validate request
      this._validateRequest(req.body);

      const { clientId, token } = await signatureService.getCredentials();

      // Prepare request payload (excluding userId)
      const payload = {
        ...req.body,
        ClientID: clientId,
        SSR: req.body.SSR || [],
        CrossSell: req.body.CrossSell || [],
        PLP: req.body.PLP || [],
        SSRAmount: req.body.SSRAmount || 0,
        CrossSellAmount: req.body.CrossSellAmount || 0,
        DeviceID: req.body.DeviceID || '',
        AppVersion: req.body.AppVersion || ''
      };

      // Make request to create itinerary
      const response = await this._makeRequest(
        'POST',
        `${BENZY_CONFIG.baseUrls.flights}/Flights/CreateItinerary`,
        payload,
        token
      );

      // Save flight details to database
      const savedFlight = await this._saveFlightDetails(response, req.body);
      
      if (!savedFlight) {
        throw new ApiError(500, 'Failed to save flight details');
      }

      // Format passenger titles to match enum
      const formattedTravellers = Travellers.map(traveller => ({
        ...traveller,
        Title: traveller.Title.toUpperCase() // Ensure title is uppercase
      }));

      // Prepare user data for booking
      const userData = {
        userId: userId || new mongoose.Types.ObjectId(), // Use provided userId or generate temporary one
        passengers: formattedTravellers.map(traveller => ({
          type: traveller.PTC,
          title: traveller.Title.toUpperCase(), // Ensure title matches enum
          firstName: traveller.FName,
          lastName: traveller.LName,
          dateOfBirth: traveller.DOB,
          nationality: traveller.Nationality,
          documents: traveller.PassportNo ? [{
            type: 'PASSPORT',
            number: traveller.PassportNo,
            issuingCountry: traveller.Nationality,
            expiryDate: traveller.PDOE
          }] : []
        })),
        contact: {
          email: ContactInfo.Email,
          phone: ContactInfo.Mobile,
          alternatePhone: ContactInfo.Phone,
          address: {
            line1: ContactInfo.Address,
            city: ContactInfo.City,
            state: ContactInfo.State,
            country: ContactInfo.CountryCode,
            postalCode: ContactInfo.PIN
          }
        },
        source: req.headers['user-agent'] ? 'WEB' : 'API',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Create booking
      const booking = await this._createBooking(
        {
          ...savedFlight.toObject(),
          transactionId: response.TransactionID,
          tui: TUI
        },
        userData,
        { status: 'PENDING', method: null }
      );

      if (!booking) {
        throw new ApiError(500, 'Failed to create booking');
      }

      return res.status(201).json({
        success: true,
        data: {
          bookingId: booking._id,
          bookingReference: booking.bookingReference,
          transactionId: response.TransactionID,
          tui: response.TUI,
          status: response.Code === '200' ? 'SUCCESS' : 'FAILED',
          message: response.Msg?.[0] || 'Itinerary created successfully'
        }
      });

    } catch (error) {
      logger.error('Itinerary creation error:', error);
      next(error);
    }
  }

  async _createBooking(flightData, userData, paymentData) {
    try {
      // Generate booking reference before creating booking
      const prefix = 'FB';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      const bookingReference = `${prefix}${timestamp}${random}`;

      const booking = new Booking({
        bookingReference, // Set generated booking reference
        transactionId: flightData.transactionId,
        userId: userData.userId,
        type: 'ONE_WAY', // Or determine based on flight data
        status: 'INITIATED',
        flights: [{
          flightId: flightData._id,
          flightNumber: flightData.flightNumber,
          tui: flightData.tui,
          provider: {
            code: flightData.provider
          },
          departure: {
            airport: {
              code: flightData.route.departure.airport.code,
              name: flightData.route.departure.airport.name,
              terminal: flightData.route.departure.terminal
            },
            scheduledTime: flightData.route.departure.scheduledTime
          },
          arrival: {
            airport: {
              code: flightData.route.arrival.airport.code,
              name: flightData.route.arrival.airport.name,
              terminal: flightData.route.arrival.terminal
            },
            scheduledTime: flightData.route.arrival.scheduledTime
          },
          cabin: flightData.aircraft.cabin // Pass cabin as string directly
        }],
        passengers: userData.passengers,
        contact: userData.contact,
        pricing: {
          currency: flightData.pricing.currency,
          totalAmount: flightData.pricing.gross,
          breakdown: {
            baseFare: flightData.pricing.net,
            taxes: [],
            fees: [],
            addons: [],
            discounts: []
          }
        },
        payment: {
          status: paymentData.status,
          method: paymentData.method
        },
        meta: {
          source: userData.source || 'API',
          ip: userData.ip,
          userAgent: userData.userAgent
        }
      });

      const savedBooking = await booking.save();
      
      if (!savedBooking) {
        throw new Error('Failed to create booking');
      }

      logger.info(`Booking created successfully with reference: ${savedBooking.bookingReference}`);
      return savedBooking;

    } catch (error) {
      logger.error('Error creating booking:', error);
      throw new ApiError(500, 'Failed to create booking', error);
    }
  }


  _validateRequest(body) {
    const requiredFields = {
      TUI: 'Transaction Unique Identifier is required',
      'ContactInfo.FName': 'Contact first name is required',
      'ContactInfo.LName': 'Contact last name is required',
      'ContactInfo.Mobile': 'Contact mobile number is required',
      'ContactInfo.Email': 'Contact email is required',
      'ContactInfo.Address': 'Contact address is required',
      'ContactInfo.CountryCode': 'Country code is required',
      'ContactInfo.State': 'State is required',
      'ContactInfo.City': 'City is required',
      'ContactInfo.PIN': 'PIN code is required',
      NetAmount: 'Net amount is required',
      Travellers: 'Traveller information is required'
    };

    const errors = [];

    for (const [field, message] of Object.entries(requiredFields)) {
      const value = field.includes('.') 
        ? field.split('.').reduce((obj, key) => obj?.[key], body)
        : body[field];

      if (!value) {
        errors.push(message);
      }
    }

    // Validate travellers information
    if (Array.isArray(body.Travellers)) {
      body.Travellers.forEach((traveller, index) => {
        const requiredTravellerFields = {
          ID: 'Traveller ID',
          Title: 'Title',
          FName: 'First name',
          LName: 'Last name',
          Gender: 'Gender',
          PTC: 'Passenger type'
        };

        for (const [field, fieldName] of Object.entries(requiredTravellerFields)) {
          if (!traveller[field]) {
            errors.push(`${fieldName} is required for traveller ${index + 1}`);
          }
        }
      });
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
        throw new ApiError(400, response.data.Msg?.[0] || 'Itinerary creation failed');
      }

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          error.response?.status || 500,
          error.response?.data?.Msg?.[0] || 'Itinerary creation failed',
          error
        );
      }
      throw error;
    }
  }

  async _saveFlightDetails(response, requestBody) {
    try {
      // Parse dates
      const departureTime = new Date(response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.DepartureTime);
      const arrivalTime = new Date(response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.ArrivalTime);
  
      const flight = new Flight({
        flightNumber: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.FlightNo,
        provider: response.Trips[0]?.Journey[0]?.Provider,
        airline: {
          code: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.VAC,
          name: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.Airline?.split('|')[0],
          marketingCarrier: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.MAC,
          operatingCarrier: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.OAC
        },
        route: {
          departure: {
            airport: {
              code: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.DepartureCode,
              name: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.DepAirportName,
            },
            terminal: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.DepartureTerminal,
            scheduledTime: departureTime
          },
          arrival: {
            airport: {
              code: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.ArrivalCode,
              name: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.ArrAirportName,
            },
            terminal: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.ArrivalTerminal,
            scheduledTime: arrivalTime
          },
          duration: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.Duration,
          stops: {
            count: parseInt(response.Trips[0]?.Journey[0]?.Stops || '0')
          }
        },
        aircraft: {
          type: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.Aircraft,
          code: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.EquipmentType,
          fareClass: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.FBC,
          cabin: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.Cabin
        },
        pricing: {
          currency: 'INR',
          gross: parseFloat(response.GrossAmount) || 0,
          net: parseFloat(response.NetAmount) || 0,
          fareBasicCode: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.FBC
        },
        availability: {
          refundable: response.Trips[0]?.Journey[0]?.Segments[0]?.Flight?.Refundable === 'Y',
          hold: response.Hold || false
        },
        inclusions: {
          baggage: response.SSR?.find(ssr => ssr.Code === 'BAG')?.Description
        }
      });
  
      // Add error handling and validation
      const savedFlight = await flight.save();
      if (!savedFlight) {
        throw new Error('Failed to save flight details');
      }
  
      logger.info(`Flight details saved successfully with ID: ${savedFlight._id}`);
      return savedFlight;
  
    } catch (error) {
      logger.error('Error saving flight details:', error);
      // Don't throw error here as this is a non-critical operation
      return null;
    }
  }

  
}


  // Export a single instance
const flightItineraryController = new FlightItineraryController();
module.exports = flightItineraryController;