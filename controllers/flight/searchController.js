const Flight = require('../../models/flightModel');          
const SearchService = require('../../services/benzy/searchService');
const redis = require('../../config/redis');
const signatureService = require('../../services/benzy/signatureService');
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const { validateSearchParams } = require('../../utils/validators');
const { flightCacheService } = require('../../services/cacheService');

const logger = createLogger('FlightSearchController');

class FlightSearchController {
    async searchFlights(req, res, next) {
      try {
        // First validate the incoming request parameters
        const searchParams = {
            tripType: req.body.tripType || 'oneway',
            origin: req.body.from || req.body.origin,
            destination: req.body.to || req.body.destination,
            departureDate: req.body.departDate || req.body.departureDate,
            returnDate: req.body.returnDate,
            adults: parseInt(req.body.adults) || 1,
            children: parseInt(req.body.children) || 0,
            infants: parseInt(req.body.infants) || 0,
            cabin: req.body.cabinClass || 'E',
            airlines: req.body.preferredAirlines || [],
            directOnly: Boolean(req.body.directOnly),
            refundableOnly: Boolean(req.body.refundableOnly),
            isStudentFare: Boolean(req.body.isStudentFare),
            isNearbyAirport: Boolean(req.body.isNearbyAirport),
            isExtendedSearch: Boolean(req.body.isExtendedSearch),
            isMultipleCarrier: Boolean(req.body.isMultipleCarrier),
            groupType: req.body.groupType || ""
          };

        // Validate search parameters before making the API call
        const validationError = validateSearchParams(searchParams);
        if (validationError) {
          throw new ApiError(400, validationError);
        }

        // Ensure we have valid credentials before starting search
        await signatureService.getCredentials();
  
        // Initiate the search with validated parameters
        const searchResponse = await SearchService.initiateSearch(searchParams);
        
        return res.json({
          success: true,
          fromCache: searchResponse.fromCache,
          data: searchResponse.data,
          TUI: searchResponse.TUI
        });
      } catch (error) {
        logger.error('Flight search error:', error);
        if (error instanceof ApiError) {
          next(error);
        } else {
          next(new ApiError(500, 'Flight search failed', error));
        }
      }
    }
  

  async getSearchResults(req, res, next) {
    try {
      const { TUI } = req.params;
      if (!TUI) {
        throw new ApiError(400, 'TUI is required');
      }

      const { token, clientId } = await signatureService.getCredentials();
      const results = await SearchService.getSearchResults(TUI, token, clientId);

      return res.json({
        success: true,
        data: {
          completed: results.completed,
          flights: results.flights
        }
      });
    } catch (error) {
      logger.error('Get search results error:', error);
      next(error);
    }
  }

  /**
   * Get flight details by ID
   */
  async getFlightDetails(req, res, next) {
    try {
      const { flightId } = req.params;
      const flight = await Flight.findById(flightId);
      
      if (!flight) {
        throw new ApiError(404, 'Flight not found');
      }

      return res.json({
        success: true,
        data: flight
      });
    } catch (error) {
      logger.error('Get flight details error:', error);
      next(error);
    }
  }

  /**
   * Get fare rules for a flight
   */
  async getFareRules(req, res, next) {
    try {
      const { TUI, FUID } = req.query;
      if (!TUI || !FUID) {
        throw new ApiError(400, 'TUI and FUID are required');
      }

      const fareRules = await SearchService.getFareRules(TUI, FUID);
      
      return res.json({
        success: true,
        data: fareRules
      });
    } catch (error) {
      logger.error('Get fare rules error:', error);
      next(error);
    }
  }

  /**
   * Get seat map for a flight
   */
  async getSeatMap(req, res, next) {
    try {
      const { TUI, FUID } = req.query;
      if (!TUI || !FUID) {
        throw new ApiError(400, 'TUI and FUID are required');
      }

      const seatMap = await SearchService.getSeatMap(TUI, FUID);
      
      return res.json({
        success: true,
        data: seatMap
      });
    } catch (error) {
      logger.error('Get seat map error:', error);
      next(error);
    }
  }

  /**
   * Get baggage information for a flight
   */
  async getBaggageInfo(req, res, next) {
    try {
      const { TUI, FUID } = req.query;
      if (!TUI || !FUID) {
        throw new ApiError(400, 'TUI and FUID are required');
      }

      const baggageInfo = await SearchService.getBaggageInfo(TUI, FUID);
      
      return res.json({
        success: true,
        data: baggageInfo
      });
    } catch (error) {
      logger.error('Get baggage info error:', error);
      next(error);
    }
  }
}

module.exports = new FlightSearchController();