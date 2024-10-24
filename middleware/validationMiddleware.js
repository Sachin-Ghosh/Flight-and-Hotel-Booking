// middleware/validationMiddleware.js
const Joi = require('joi');
const { createLogger } = require('../utils/logger');
const { ResponseError } = require('../utils/response');
const { ValidationError } = require('../utils/errors');

const logger = createLogger('ValidationMiddleware');

// Validation schemas
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).required()
  }),

  verifyEmail: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required()
  }),

  verifyLoginOTP: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required()
  }),

  flightSearch: Joi.object({
    tripType: Joi.string().valid('oneway', 'return', 'multicity').required(),
    from: Joi.string().length(3).required(),
    to: Joi.string().length(3).required(),
    departDate: Joi.date().greater('now').required(),
    returnDate: Joi.when('tripType', {
      is: 'return',
      then: Joi.date().greater(Joi.ref('departDate')).required(),
      otherwise: Joi.forbidden()
    }),
    adults: Joi.number().min(1).max(9).required(),
    children: Joi.number().min(0).max(9).default(0),
    infants: Joi.number().min(0).max(9).default(0),
    cabinClass: Joi.string().valid('economy', 'business', 'first').required(),
    preferredAirlines: Joi.array().items(Joi.string().length(2)).optional()
  }),

  booking: Joi.object({
    flightId: Joi.string().required(),
    passengers: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('adult', 'child', 'infant').required(),
        title: Joi.string().valid('Mr', 'Mrs', 'Ms', 'Mstr', 'Miss').required(),
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        dob: Joi.date().required(),
        passport: Joi.when('isInternational', {
          is: true,
          then: Joi.object({
            number: Joi.string().required(),
            expiryDate: Joi.date().greater('now').required(),
            issuingCountry: Joi.string().length(2).required()
          }).required(),
          otherwise: Joi.forbidden()
        })
      })
    ).min(1).required(),
    contactInfo: Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).required(),
      address: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        country: Joi.string().required(),
        zipCode: Joi.string().required()
      }).required()
    }).required()
  })
};

// Request validation middleware
// Updated request validation middleware
exports.validateRequest = (schemaName) => {
    return (req, res, next) => {
      try {
        if (!schemas[schemaName]) {
          throw new ValidationError(`Validation schema '${schemaName}' not found`);
        }
  
        const { error } = schemas[schemaName].validate(req.body, { 
          abortEarly: false,
          stripUnknown: true
        });
  
        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));
          
          throw new ValidationError('Validation failed', errors);
        }
  
        next();
      } catch (error) {
        logger.error('Validation error:', {
          schema: schemaName,
          body: req.body,
          error: error.message,
          stack: error.stack
        });
  
        // Use the error's status code if it exists, otherwise default to 400 for validation errors
        const status = error.status || 400;
        res.status(status).json({
          success: false,
          message: error.message,
          errors: error.errors,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
      }
    };
  };