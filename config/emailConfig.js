// emailConfig.js

const path = require('path');

// Environment-specific SMTP configurations
const smtpConfigs = {
  development: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    user: 'your-dev-email@gmail.com',
    password: 'your-dev-app-specific-password',
  },
  staging: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'your-staging-email@gmail.com',
    password: 'your-staging-app-specific-password',
  },
  production: {
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    user: 'apikey',
    password: process.env.SENDGRID_API_KEY,
  }
};

// // Template configurations
// const templateConfig = {
//   baseDir: path.join(__dirname, '../templates/email'),
//   templates: {
//     'email-verification': {
//       subject: 'Verify Your Email Address',
//       template: 'verification.html',
//       attachments: [],
//     },
//     'booking-confirmation': {
//       subject: 'Booking Confirmation',
//       template: 'booking.html',
//       attachments: [
//         {
//           filename: 'logo.png',
//           path: path.join(__dirname, '../assets/images/logo.png'),
//           cid: 'company-logo'
//         }
//       ]
//     },
//     'payment-receipt': {
//       subject: 'Payment Receipt',
//       template: 'payment.html',
//       attachments: [
//         {
//           filename: 'logo.png',
//           path: path.join(__dirname, '../assets/images/logo.png'),
//           cid: 'company-logo'
//         }
//       ]
//     },
//     'login-otp': {
//       subject: 'Login OTP',
//       template: 'otp.html',
//       attachments: []
//     },
//     'booking-cancellation': {
//       subject: 'Booking Cancellation Confirmation',
//       template: 'cancellation.html',
//       attachments: []
//     },
//     'refund-initiated': {
//       subject: 'Refund Initiated',
//       template: 'refund.html',
//       attachments: []
//     },
//     'itinerary': {
//       subject: 'Your Travel Itinerary',
//       template: 'itinerary.html',
//       attachments: [
//         {
//           filename: 'logo.png',
//           path: path.join(__dirname, '../assets/images/logo.png'),
//           cid: 'company-logo'
//         }
//       ]
//     }
//   }
// };

// Email sender configurations
const senderConfig = {
  development: {
    name: 'TravelApp Dev',
    email: 'dev@travelapp.com'
  },
  staging: {
    name: 'TravelApp Staging',
    email: 'staging@travelapp.com'
  },
  production: {
    name: 'TravelApp',
    email: 'bookings@travelapp.com'
  }
};

// Rate limiting configuration
const rateLimits = {
  development: {
    maxPerHour: 50,
    maxPerDay: 100,
    rateLimitDelay: 1000 // delay between emails in ms
  },
  staging: {
    maxPerHour: 100,
    maxPerDay: 500,
    rateLimitDelay: 500
  },
  production: {
    maxPerHour: 1000,
    maxPerDay: 10000,
    rateLimitDelay: 100
  }
};

// Retry configuration
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  backoffMultiplier: 2
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';

// Export consolidated config
module.exports = {
  smtp: {
    ...smtpConfigs[environment],
    pool: true, // use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: true,
    rateDelta: 1000,
    rateLimit: rateLimits[environment].maxPerHour,
    secure: environment === 'production', // force TLS in production
    tls: {
      rejectUnauthorized: environment === 'production'
    }
  },
//   templates: templateConfig.templates,
//   templateDir: templateConfig.baseDir,
  from: {
    name: senderConfig[environment].name,
    email: senderConfig[environment].email
  },
  rateLimits: rateLimits[environment],
  retry: retryConfig,
  
//   // Helper functions
//   getTemplateConfig(templateName) {
//     const template = this.templates[templateName];
//     if (!template) {
//       throw new Error(`Email template '${templateName}' not found`);
//     }
//     return {
//       ...template,
//       templatePath: path.join(this.templateDir, template.template)
//     };
//   },

//   getAttachments(templateName) {
//     const template = this.templates[templateName];
//     return template ? template.attachments : [];
//   },

  getSMTPConfig() {
    return this.smtp;
  },

  getRetryConfig() {
    return this.retry;
  },

  getRateLimits() {
    return this.rateLimits;
  },

  getSenderInfo() {
    return this.from;
  },

//   // Validation helper
//   validateTemplate(templateName) {
//     if (!this.templates[templateName]) {
//       throw new Error(`Invalid template name: ${templateName}`);
//     }
//     const templatePath = path.join(this.templateDir, this.templates[templateName].template);
//     try {
//       require('fs').accessSync(templatePath, require('fs').constants.R_OK);
//       return true;
//     } catch (error) {
//       throw new Error(`Template file not accessible: ${templatePath}`);
//     }
//   }
};