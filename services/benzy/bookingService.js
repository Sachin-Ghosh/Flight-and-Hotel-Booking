// services/benzy/booking.service.js
const axios = require('axios');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('./signatureService');
const searchService = require('./searchService');
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const FlightBooking = require('../../models/bookingModel.js');
const cacheService = require('../cacheService');

const logger = createLogger('BookingService');

class BookingService {
  constructor() {
    this.bookingCache = new Map();
  }

  async createItinerary(bookingDetails) {
    try {
      const token = await signatureService.getToken();
      const pricingDetails = await this._validatePricing(bookingDetails);

      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flight/CreateItinerary`,
        {
          TUI: pricingDetails.TUI,
          ChannelID: BENZY_CONFIG.channelId,
          Passengers: this._formatPassengers(bookingDetails.passengers),
          ContactDetails: this._formatContactDetails(bookingDetails.contact),
          SSRDetails: this._formatSSRDetails(bookingDetails.ancillaries),
          GST: bookingDetails.gst || null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.Code !== "200") {
        throw new ApiError(response.data.Code, response.data.Msg);
      }

      // Create booking record in MongoDB
      const booking = await FlightBooking.create({
        userId: bookingDetails.userId,
        transactionId: response.data.TransactionId,
        bookingStatus: 'INITIATED',
        bookingDetails: {
          tui: pricingDetails.TUI,
          flightDetails: pricingDetails.pricing.flights,
          passengers: bookingDetails.passengers,
          contactDetails: bookingDetails.contact
        },
        fareDetails: pricingDetails.pricing.fare,
        paymentDetails: {
          status: 'PENDING'
        }
      });

      // Cache booking details for payment processing
      this.bookingCache.set(response.data.TransactionId, {
        booking,
        pricingDetails,
        expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes expiry
      });

      return {
        transactionId: response.data.TransactionId,
        bookingId: booking._id,
        expiryTime: 15 * 60 // 15 minutes in seconds
      };
    } catch (error) {
      logger.error('Error creating itinerary:', error);
      throw error;
    }
  }

  async initiatePayment(transactionId, paymentMethod) {
    try {
      const cachedBooking = this.bookingCache.get(transactionId);
      if (!cachedBooking) {
        throw new ApiError(404, 'Booking session expired');
      }

      const token = await signatureService.getToken();
      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flight/StartPay`,
        {
          TransactionId: transactionId,
          ChannelID: BENZY_CONFIG.channelId,
          PaymentAmount: cachedBooking.pricingDetails.pricing.fare.totalAmount,
          PaymentType: this._mapPaymentMethod(paymentMethod),
          Currency: cachedBooking.pricingDetails.pricing.fare.currency
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.Code !== "200") {
        throw new ApiError(response.data.Code, response.data.Msg);
      }

      // Update booking status
      await FlightBooking.findByIdAndUpdate(cachedBooking.booking._id, {
        'bookingStatus': 'PAYMENT_PENDING',
        'paymentDetails.razorpayOrderId': response.data.OrderId
      });

      return {
        orderId: response.data.OrderId,
        amount: cachedBooking.pricingDetails.pricing.fare.totalAmount,
        currency: cachedBooking.pricingDetails.pricing.fare.currency
      };
    } catch (error) {
      logger.error('Error initiating payment:', error);
      throw error;
    }
  }

  async confirmPayment(transactionId, paymentDetails) {
    try {
      const cachedBooking = this.bookingCache.get(transactionId);
      if (!cachedBooking) {
        throw new ApiError(404, 'Booking session expired');
      }

      // Verify payment with Benzy
      const token = await signatureService.getToken();
      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flight/ConfirmPayment`,
        {
          TransactionId: transactionId,
          PaymentId: paymentDetails.paymentId,
          OrderId: paymentDetails.orderId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.Code !== "200") {
        throw new ApiError(response.data.Code, response.data.Msg);
      }

      // Update booking status and payment details
      const booking = await FlightBooking.findByIdAndUpdate(
        cachedBooking.booking._id,
        {
          'bookingStatus': 'CONFIRMED',
          'bookingDetails.pnr': response.data.PNR,
          'bookingDetails.providerReference': response.data.ProviderReference,
          'paymentDetails': {
            razorpayOrderId: paymentDetails.orderId,
            paymentId: paymentDetails.paymentId,
            status: 'COMPLETED',
            amount: cachedBooking.pricingDetails.pricing.fare.totalAmount,
            method: paymentDetails.method,
            timestamp: new Date()
          }
        },
        { new: true }
      );

      // Clear booking cache
      this.bookingCache.delete(transactionId);

      return booking;
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  async cancelBooking(bookingId, cancellationDetails) {
    try {
      const booking = await FlightBooking.findById(bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      const token = await signatureService.getToken();
      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flight/Cancel`,
        {
          TransactionId: booking.transactionId,
          PNR: booking.bookingDetails.pnr,
          Passengers: this._formatCancellationPassengers(cancellationDetails.passengers)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.Code !== "200") {
        throw new ApiError(response.data.Code, response.data.Msg);
      }

      // Update booking status
      booking.bookingStatus = 'CANCELLED';
      booking.cancellationDetails = {
        cancelledAt: new Date(),
        reason: cancellationDetails.reason,
        refundAmount: response.data.RefundAmount,
        refundStatus: 'PENDING'
      };

      await booking.save();

      return {
        bookingId: booking._id,
        refundAmount: response.data.RefundAmount,
        refundStatus: 'PENDING'
      };
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  async retrieveBooking(bookingId) {
    try {
      const booking = await FlightBooking.findById(bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      const token = await signatureService.getToken();
      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flight/RetrieveBooking`,
        {
          TransactionId: booking.transactionId,
          PNR: booking.bookingDetails.pnr
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.Code !== "200") {
        throw new ApiError(response.data.Code, response.data.Msg);
      }

      // Update booking status if needed
      if (response.data.BookingStatus !== booking.bookingStatus) {
        booking.bookingStatus = response.data.BookingStatus;
        await booking.save();
      }

      return {
        booking,
        providerDetails: response.data
      };
    } catch (error) {
      logger.error('Error retrieving booking:', error);
      throw error;
    }
  }
  

  // Private helper methods
  async _validatePricing(bookingDetails) {
    const pricingDetails = await cacheService.get(`pricing:${bookingDetails.TUI}`);
    if (!pricingDetails) {
      throw new ApiError(400, 'Pricing session expired');
    }
    return pricingDetails;
  }

  _formatPassengers(passengers) {
    return passengers.map(passenger => ({
      Type: passenger.type,
      Title: passenger.title,
      FirstName: passenger.firstName,
      LastName: passenger.lastName,
      DateOfBirth: passenger.dateOfBirth,
      Nationality: passenger.nationality,
      PassportNo: passenger.documents?.[0]?.number,
      PassportExpiry: passenger.documents?.[0]?.expiryDate,
      IssuingCountry: passenger.documents?.[0]?.issuingCountry
    }));
  }

  _formatContactDetails(contact) {
    return {
      Email: contact.email,
      Mobile: contact.phone,
      Address: contact.address?.line1,
      City: contact.address?.city,
      CountryCode: contact.address?.country
    };
  }

  async validateSelectedSeats(tui, selectedSeats) {
    const cachedLayout = await cacheService.get(`seat-layout:${tui}`);
    if (!cachedLayout) {
      throw new ApiError(400, 'Seat layout session expired');
    }

    // Validate each selected seat
    for (const seat of selectedSeats) {
      const flight = cachedLayout.flights.find(f => 
        f.flightNumber === seat.flightNumber
      );

      if (!flight) {
        throw new ApiError(400, `Invalid flight number: ${seat.flightNumber}`);
      }

      const seatData = flight.seatMap.rows
        .flatMap(row => row.seats)
        .find(s => s.number === seat.seatNumber);

      if (!seatData) {
        throw new ApiError(400, `Invalid seat number: ${seat.seatNumber}`);
      }

      if (!seatData.available) {
        throw new ApiError(400, `Seat ${seat.seatNumber} is not available`);
      }

      // Validate pricing
      if (seatData.pricing.total !== seat.amount) {
        throw new ApiError(400, `Invalid pricing for seat ${seat.seatNumber}`);
      }
    }

    return true;
  }

  _formatSSRDetails(ancillaries) {
    const ssrDetails = [];
    
    if (ancillaries?.seats?.length) {
      // Validate seats before formatting
       this.validateSelectedSeats(
        ancillaries.tui,
        ancillaries.seats
      );

      ssrDetails.push(...ancillaries.seats.map(seat => ({
        Type: 'SEAT',
        FlightNumber: seat.flightNumber,
        PassengerIndex: seat.passengerIndex,
        Code: seat.seatNumber,
        Amount: seat.amount,
        SSID: seat.ssrCode
      })));
    }

    if (ancillaries?.baggage?.length) {
      ssrDetails.push(...ancillaries.baggage.map(baggage => ({
        Type: 'BAGGAGE',
        FlightNumber: baggage.flightNumber,
        PassengerIndex: baggage.passenger,
        Weight: baggage.weight
      })));
    }

    return ssrDetails;
  }

  _formatCancellationPassengers(passengers) {
    return passengers.map(passenger => ({
      PassengerIndex: passenger.index,
      Segments: passenger.segments
    }));
  }

  _mapPaymentMethod(method) {
    const methodMap = {
      'CREDIT_CARD': 'CC',
      'DEBIT_CARD': 'DC',
      'NET_BANKING': 'NB',
      'UPI': 'UPI',
      'WALLET': 'WL'
    };
    return methodMap[method] || 'CC';
  }
}

module.exports = new BookingService();