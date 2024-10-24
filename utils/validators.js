// validators.js
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };
  
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const validateSearchParams = (params) => {
    const errors = [];
  
    if (!params.origin) {
      errors.push('Origin city is required');
    }
  
    if (!params.destination) {
      errors.push('Destination city is required');
    }
  
    if (!params.departureDate) {
      errors.push('Departure date is required');
    }
  
    // Validate departure date is not in the past
    if (params.departureDate) {
      const departDate = new Date(params.departureDate);
      if (departDate < new Date(new Date().setHours(0, 0, 0, 0))) {
        errors.push('Departure date cannot be in the past');
      }
    }
  
    // Validate return date for round trips
    if (params.tripType === 'roundtrip' && !params.returnDate) {
      errors.push('Return date is required for round trips');
    }
  
    if (params.returnDate && params.departureDate) {
      const returnDate = new Date(params.returnDate);
      const departDate = new Date(params.departureDate);
      if (returnDate < departDate) {
        errors.push('Return date must be after departure date');
      }
    }
  
    // Validate cabin class
    // const validCabins = ['E', 'PE', 'B', 'F'];
    // if (params.cabin && !validCabins.includes(params.cabin.toUpperCase())) {
    //   errors.push('Invalid cabin class');
    // }
  
    // Validate passenger counts
    if (params.adults < 1) {
      errors.push('At least one adult passenger is required');
    }
  
    if ((params.adults + params.children + params.infants) > 9) {
      errors.push('Maximum 9 passengers allowed per booking');
    }
  
    if (params.infants > params.adults) {
      errors.push('Number of infants cannot exceed number of adults');
    }
  
    return errors.length > 0 ? errors.join(', ') : null;
  };
  
  module.exports = { validateSearchParams };
  
  module.exports = {
    generateOTP,
    validateEmail,
    validateSearchParams
  };
  