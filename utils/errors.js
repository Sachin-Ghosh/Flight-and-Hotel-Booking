// errors.js
class ApiError extends Error {
    constructor(statusCode, message, originalError = null) {
      super(message);
      this.statusCode = statusCode;
      this.originalError = originalError;
      this.name = 'ApiError';
    }
  }

class ResponseError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.name = 'ResponseError';
      this.status = status;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class ValidationError extends ResponseError {
    constructor(message, errors = []) {
      super(message, 400);
      this.name = 'ValidationError';
      this.errors = errors;
    }
  }
  
  class AuthenticationError extends ResponseError {
    constructor(message) {
      super(message, 401);
      this.name = 'AuthenticationError';
    }
  }
  
  class AuthorizationError extends ResponseError {
    constructor(message) {
      super(message, 403);
      this.name = 'AuthorizationError';
    }
  }
  
  class NotFoundError extends ResponseError {
    constructor(message) {
      super(message, 404);
      this.name = 'NotFoundError';
    }
  }
  
  // Error response formatter
  const formatErrorResponse = (error) => {
    const response = {
      success: false,
      message: error.message,
      status: error.status || 500
    };
  
    // Add validation errors if present
    if (error instanceof ValidationError && error.errors.length > 0) {
      response.errors = error.errors;
    }
  
    // Add stack trace in development environment
    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }
  
    return response;
  };
  
  module.exports = {
    ResponseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ApiError,
    formatErrorResponse
  };
  