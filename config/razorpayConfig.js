// razorpayConfig.js
const Razorpay = require('razorpay');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RazorpayConfig');

const razorpayConfig = {
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
  options: {
    currency: 'INR',
    payment_capture: 1,
    notes: {
      merchant_order_id: '',
    },
    webhook_url: process.env.RAZORPAY_WEBHOOK_URL
  }
};

// Initialize Razorpay instance
let razorpayInstance;
try {
  razorpayInstance = new Razorpay({
    key_id: razorpayConfig.key_id,
    key_secret: razorpayConfig.key_secret
  });
  logger.info('Razorpay initialized successfully');
} catch (error) {
  logger.error('Razorpay initialization failed:', error);
  process.exit(1);
}

module.exports = {
  razorpayConfig,
  razorpayInstance
};