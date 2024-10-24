// response.js
const createResponse = (success, message, data = null) => {
    return {
      success,
      message,
      ...(data && { data })
    };
  };
  
  const createErrorResponse = (error) => {
    return {
      success: false,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    };
  };
  
  const createPaginatedResponse = (data, page, limit, total) => {
    return {
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  };
  
  module.exports = {
    createResponse,
    createErrorResponse,
    createPaginatedResponse
  };