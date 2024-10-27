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