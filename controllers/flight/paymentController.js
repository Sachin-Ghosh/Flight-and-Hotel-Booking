// controllers/payment/paymentController.js
const Payment = require('../../models/paymentModel');
const Booking = require('../../models/bookingModel');
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const signatureService = require('../../services/benzy/signatureService');
const BENZY_CONFIG = require('../../config/benzyConfig');
const axios = require('axios');

const logger = createLogger('PaymentController');

class PaymentController {
  constructor() {
    this.initiatePayment = this.initiatePayment.bind(this);
    this.handlePaymentCallback = this.handlePaymentCallback.bind(this);
  }

  async initiatePayment(req, res, next) {
    try {
      const { bookingId } = req.params;
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      if (booking.payment.status === 'COMPLETED') {
        throw new ApiError(400, 'Payment already completed for this booking');
      }

      const { clientId, token } = await signatureService.getCredentials();

      // Prepare payment payload
      const payload = {
        TransactionID: parseInt(booking.transactionId),
        PaymentAmount: 0,
        NetAmount: booking.pricing.totalAmount,
        BrowserKey: req.headers['browser-key'] || '',
        ClientID: clientId,
        TUI: booking.flights[0].tui,
        Hold: false,
        Promo: null,
        PaymentType: '',
        BankCode: '',
        GateWayCode: '',
        MerchantID: '',
        PaymentCharge: 0,
        ReleaseDate: '',
        OnlinePayment: false,
        DepositPayment: true,
        Card: {
          Number: '',
          Expiry: '',
          CVV: '',
          CHName: '',
          Address: '',
          City: '',
          State: '',
          Country: '',
          PIN: '',
          International: false,
          SaveCard: false,
          FName: '',
          LName: '',
          EMIMonths: '0'
        },
        VPA: '',
        CardAlias: '',
        QuickPay: null,
        RMSSignature: '',
        TargetCurrency: '',
        TargetAmount: 0,
        ServiceType: 'ITI'
      };


    //   class PaymentController {
    //     constructor() {
    //       this.initiatePayment = this.initiatePayment.bind(this);
    //       this.handlePaymentCallback = this.handlePaymentCallback.bind(this);
    //       this.addUserCard = this.addUserCard.bind(this);
    //     }
      
    //     async addUserCard(req, res, next) {
    //       try {
    //         const userId = req.user._id; // Assuming you have user auth middleware
    //         const {
    //           cardNumber,
    //           cardHolderName,
    //           expiryMonth,
    //           expiryYear,
    //           cvv,
    //           isDefault,
    //           billingAddress,
    //           isInternational
    //         } = req.body;
      
    //         const user = await User.findById(userId);
    //         if (!user) {
    //           throw new ApiError(404, 'User not found');
    //         }
      
    //         // If this is the first card or marked as default, set all other cards to non-default
    //         if (isDefault || user.cards.length === 0) {
    //           user.cards.forEach(card => card.isDefault = false);
    //         }
      
    //         const newCard = {
    //           cardNumber,
    //           cardHolderName,
    //           expiryMonth,
    //           expiryYear,
    //           cardType: this.detectCardType(cardNumber),
    //           isDefault: isDefault || user.cards.length === 0,
    //           billingAddress,
    //           isInternational
    //         };
      
    //         user.cards.push(newCard);
    //         await user.save();
      
    //         // Return only last 4 digits in response
    //         newCard.cardNumber = newCard.cardNumber.slice(-4);
            
    //         return res.status(200).json({
    //           success: true,
    //           message: 'Card added successfully',
    //           data: newCard
    //         });
    //       } catch (error) {
    //         logger.error('Add card error:', error);
    //         next(error);
    //       }
    //     }
      
    //     async initiatePayment(req, res, next) {
    //       try {
    //         const { bookingId } = req.params;
    //         const { savedCardId } = req.body; // If using saved card
    //         const booking = await Booking.findById(bookingId);
    //         const user = await User.findById(req.user._id);
            
    //         if (!booking) {
    //           throw new ApiError(404, 'Booking not found');
    //         }
      
    //         if (booking.payment.status === 'COMPLETED') {
    //           throw new ApiError(400, 'Payment already completed for this booking');
    //         }
      
    //         const { clientId, token } = await signatureService.getCredentials();
      
    //         // Get card details if using saved card
    //         let cardDetails = {
    //           Number: '',
    //           Expiry: '',
    //           CVV: '',
    //           CHName: '',
    //           Address: '',
    //           City: '',
    //           State: '',
    //           Country: '',
    //           PIN: '',
    //           International: false,
    //           SaveCard: false,
    //           FName: '',
    //           LName: '',
    //           EMIMonths: '0'
    //         };
      
    //         if (savedCardId && user) {
    //           const savedCard = user.cards.find(card => card._id.toString() === savedCardId);
    //           if (savedCard) {
    //             cardDetails = {
    //               Number: savedCard._fullCardNumber || '', // This will be available only during card creation
    //               Expiry: `${savedCard.expiryMonth}${savedCard.expiryYear.slice(-2)}`,
    //               CHName: savedCard.cardHolderName,
    //               Address: savedCard.billingAddress?.street || '',
    //               City: savedCard.billingAddress?.city || '',
    //               State: savedCard.billingAddress?.state || '',
    //               Country: savedCard.billingAddress?.country || '',
    //               PIN: savedCard.billingAddress?.postalCode || '',
    //               International: savedCard.isInternational,
    //               SaveCard: false,
    //               FName: savedCard.cardHolderName.split(' ')[0],
    //               LName: savedCard.cardHolderName.split(' ').slice(1).join(' '),
    //               EMIMonths: '0'
    //             };
    //           }
    //         }
      
    //         // Prepare payment payload
    //         const payload = {
    //           TransactionID: parseInt(booking.transactionId),
    //           PaymentAmount: 0,
    //           NetAmount: booking.pricing.totalAmount,
    //           BrowserKey: req.headers['browser-key'] || '',
    //           ClientID: clientId,
    //           TUI: booking.flights[0].tui,
    //           Hold: false,
    //           Promo: null,
    //           PaymentType: '',
    //           BankCode: '',
    //           GateWayCode: '',
    //           MerchantID: '',
    //           PaymentCharge: 0,
    //           ReleaseDate: '',
    //           OnlinePayment: false,
    //           DepositPayment: true,
    //           Card: cardDetails,
    //           VPA: '',
    //           CardAlias: '',
    //           QuickPay: null,
    //           RMSSignature: '',
    //           TargetCurrency: '',
    //           TargetAmount: 0,
    //           ServiceType: 'ITI'
    //         };
      
    //         // Rest of the initiatePayment method remains the same...
    //       } catch (error) {
    //         logger.error('Payment initiation error:', error);
    //         next(error);
    //       }
    //     }

      // Make API request to initiate payment
      const response = await axios({
        method: 'POST',
        url: `${BENZY_CONFIG.baseUrls.flights}/Payment/StartPay`,
        data: payload,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Create payment record
      const payment = new Payment({
        bookingId: booking._id,
        transactionId: booking.transactionId,
        tui: booking.flights[0].tui,
        paymentAmount: booking.pricing.totalAmount,
        netAmount: booking.pricing.totalAmount,
        status: 'INITIATED',
        paymentType: 'DEPOSIT',
        paymentGateway: {
          code: response.data.GatewayCode,
          paymentId: response.data.PaymentID,
          redirectUrl: response.data.RedirectUrl,
          metadata: response.data
        },
        response: {
          code: response.data.Code,
          message: response.data.Msg?.[0],
          bookStatus: response.data.BookStatus,
          crsPnr: response.data.CRSPNR,
          redirectMode: response.data.RedirectMode,
          postData: response.data.PostData
        },
        history: [{
          status: 'INITIATED',
          timestamp: new Date(),
          remarks: 'Payment initiated'
        }]
      });

      await payment.save();

      // Update booking status
      booking.payment.status = 'PROCESSING';
      await booking.save();

      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          redirectUrl: response.data.RedirectUrl,
          redirectMode: response.data.RedirectMode,
          status: response.data.Code === '200' ? 'SUCCESS' : 'PENDING'
        }
      });

    } catch (error) {
      logger.error('Payment initiation error:', error);
      next(error);
    }
  }

  async handlePaymentCallback(req, res, next) {
    try {
      const { transactionId } = req.params;
      const payment = await Payment.findOne({ transactionId });
      
      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      const booking = await Booking.findById(payment.bookingId);
      if (!booking) {
        throw new ApiError(404, 'Booking not found');
      }

      // Update payment status based on response
      const isSuccess = req.body.Code === '200' || req.body.Code === '6033';
      const newStatus = isSuccess ? 'SUCCESS' : 'FAILED';

      // Update payment record
      payment.status = newStatus;
      payment.response = {
        code: req.body.Code,
        message: req.body.Msg?.[0],
        bookStatus: req.body.BookStatus,
        crsPnr: req.body.CRSPNR,
        redirectMode: req.body.RedirectMode,
        postData: req.body.PostData
      };
      payment.history.push({
        status: newStatus,
        timestamp: new Date(),
        remarks: req.body.Msg?.[0]
      });

      await payment.save();

      // Update booking status
      booking.payment.status = isSuccess ? 'COMPLETED' : 'FAILED';
      booking.status = isSuccess ? 'CONFIRMED' : 'CANCELLED';
      if (req.body.CRSPNR) {
        booking.flights[0].provider.pnr = req.body.CRSPNR;
      }

      await booking.save();

      // If this is an API callback, send response
      if (req.headers['content-type'] === 'application/json') {
        return res.status(200).json({
          success: true,
          data: {
            paymentId: payment._id,
            status: newStatus,
            message: req.body.Msg?.[0]
          }
        });
      }

      // If this is a redirect callback, redirect to appropriate page
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${baseUrl}/booking/${booking.bookingReference}`;
      res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Payment callback error:', error);
      next(error);
    }
  }
}

const paymentController = new PaymentController();
module.exports = paymentController;