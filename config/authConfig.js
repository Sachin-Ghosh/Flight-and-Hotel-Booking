// authConfig.js
const authConfig = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: '24h',
    OTP_EXPIRY: 10 * 60 * 1000, // 10 minutes
    OTP_LENGTH: 6,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 30 * 60 * 1000, // 30 minutes
    PASSWORD_HASH_ROUNDS: 10,
    SESSION_COOKIE_NAME: 'session_token',
    COOKIE_SECRET: process.env.COOKIE_SECRET,
    CORS_ORIGINS: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      ['http://localhost:3000',
        'https://flight-and-hotel-booking-backend.onrender.com'
      ]
  };
  
  module.exports = authConfig;