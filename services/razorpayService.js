// razorpay.service.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');
const RAZORPAY_CONFIG = require('../config/razorpayConfig');

const logger = createLogger('RazorpayService');

class RazorpayService {
  constructor() {
    this.instance = new Razorpay({
      key_id: RAZORPAY_CONFIG.keyId,
      key_secret: RAZORPAY_CONFIG.keySecret
    });
  }

  async createOrder(amount, currency = 'INR', receipt) {
    try {
      const options = {
        amount: amount * 100, // Convert to smallest currency unit
        currency,
        receipt,
        payment_capture: 1
      };

      const order = await this.instance.orders.create(options);
      return order;
    } catch (error) {
      logger.error('Order creation error:', error);
      throw error;
    }
  }

  async verifyPayment(paymentId, orderId, signature) {
    try {
      const text = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
        .update(text)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      logger.error('Payment verification error:', error);
      throw error;
    }
  }

  async refundPayment(paymentId, amount) {
    try {
      const refund = await this.instance.payments.refund(paymentId, {
        amount: amount * 100
      });
      return refund;
    } catch (error) {
      logger.error('Refund error:', error);
      throw error;
    }
  }

  async getPaymentDetails(paymentId) {
    try {
      const payment = await this.instance.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      logger.error('Payment details error:', error);
      throw error;
    }
  }
}

module.exports = new RazorpayService();