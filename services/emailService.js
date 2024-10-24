const nodemailer = require('nodemailer');
const { createLogger } = require('../utils/logger');
const EMAIL_CONFIG = require('../config/emailConfig');

const logger = createLogger('EmailService');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.smtp.host,
      port: EMAIL_CONFIG.smtp.port,
      secure: EMAIL_CONFIG.smtp.secure,
      auth: {
        user: EMAIL_CONFIG.smtp.user,
        pass: EMAIL_CONFIG.smtp.password
      }
    });

    // this.templates = {
    //   'email-verification': require('../templates/email-verification'),
    //   'booking-confirmation': require('../templates/booking-confirmation'),
    //   'payment-receipt': require('../templates/payment-receipt'),
    //   'login-otp': require('../templates/login-otp')
    // };
  }

  async sendEmail({ to, subject, template, data }) {
    try {
    //   const htmlContent = this.templates[template](data);

      const mailOptions = {
        from: EMAIL_CONFIG.from,
        to,
        subject,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      
      return info;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  async sendBookingConfirmation(booking) {
    try {
      await this.sendEmail({
        to: booking.user.email,
        subject: 'Booking Confirmation',
        template: 'booking-confirmation',
        data: {
          bookingId: booking._id,
          userName: booking.user.name,
          flightDetails: booking.flight,
          passengers: booking.passengers,
          amount: booking.payment.amount
        }
      });
    } catch (error) {
      logger.error('Booking confirmation email error:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();