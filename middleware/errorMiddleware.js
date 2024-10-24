// middleware/errorMiddleware.js
const { createLogger } = require('../utils/logger');
const { ResponseError } = require('../utils/response');

const logger = createLogger('ErrorMiddleware');

exports.errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err instanceof ResponseError) {
    return res.status(err.status).json({
      success: false,
      message: err.message
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map(e => e.message).join(', ')
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds limit'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};