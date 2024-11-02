// controllers/flight/ssrController.js
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const cacheService = require('../../services/cacheService');
const axios = require('axios');

const logger = createLogger('SSRController');

class SSRController {
  constructor() {
    this.getFlightSSR = this.getFlightSSR.bind(this);
    this.validateSSRSelection = this.validateSSRSelection.bind(this);
  }

  async getFlightSSR(req, res, next) {
    try {
      const { tui, flightNumber } = req.params;
      const { source = 'LV', fareType = 'N' } = req.query;

      // Get authentication token
      const { clientId, token } = await signatureService.getCredentials();

      // Prepare payload for both free and paid SSRs
      const payload = {
        ClientID: clientId,
        Source: source,
        FareType: fareType,
        Trips: [{
          Amount: 0,
          Index: "",
          OrderID: 1,
          TUI: tui
        }]
      };

    //   console.log(payload)

      // Fetch both free and paid SSRs
      const [freeSSR, paidSSR] = await Promise.all([
        this._fetchSSR({ ...payload, PaidSSR: false }, token),
        this._fetchSSR({ ...payload, PaidSSR: true }, token)
      ]);

      // Extract SSRs for the specific flight
      const flightSSRs = this._extractFlightSSRs(freeSSR, paidSSR, flightNumber);
    //   console.log('Extracted SSRs:', JSON.stringify(flightSSRs, null, 2));
      // Cache the SSR data for validation during itinerary creation
      await cacheService.set(
        `ssr:${tui}:${flightNumber}`,
        flightSSRs,
        60 * 15 // Cache for 15 minutes
      );

    //   console.log(flightSSRs)
      
    // console.log('Categorized SSRs:', JSON.stringify(this._categorizeSSRs(flightSSRs), null, 2));

      return res.status(200).json({
        success: true,
        data: {
          flightNumber,
          ssrs: this._categorizeSSRs(flightSSRs)
        }
      });

    } catch (error) {
      logger.error('Error fetching SSRs:', error);
      next(error);
    }
  }

  async validateSSRSelection(req, res, next) {
    try {
      const { tui, flightNumber } = req.params;
      const { ssrs } = req.body;

      // Get cached SSR data
      const cachedSSRs = await cacheService.get(`ssr:${tui}:${flightNumber}`);
      if (!cachedSSRs) {
        throw new ApiError(400, 'SSR session expired');
      }

      // Validate each selected SSR
      const validationResults = await this._validateSSRs(ssrs, cachedSSRs);

      return res.status(200).json({
        success: true,
        data: {
          valid: validationResults.every(result => result.valid),
          validationDetails: validationResults
        }
      });

    } catch (error) {
      logger.error('Error validating SSRs:', error);
      next(error);
    }
  }

  async _fetchSSR(payload, token) {
    try {
        // console.log(payload)
      const response = await axios.post(
        `${BENZY_CONFIG.baseUrls.flights}/Flights/SSR`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.Code !== '200') {
        throw new ApiError(400, response.data.Msg || 'Failed to fetch SSRs');
      }

    //   console.log(response.data)
      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          error.response?.status || 500,
          error.response?.data?.Msg || 'Failed to fetch SSRs',
          error
        );
      }
      throw error;
    }
  }

//   _extractFlightSSRs(freeSSR, paidSSR, flightNumber) {
   
//     const extractSSRs = (ssrData) => {
//       return ssrData.Trips?.[0]?.Journey?.[0]?.Segments
//         ?.filter(segment => !flightNumber || segment.FUID === flightNumber)
//         ?.flatMap(segment => segment.SSR || [])
//         ?.map(ssr => ({
//           ...ssr,
//           isPaid: Boolean(ssr.Charge > 0)
//         })) || [];
//     };

//     return [
//       ...extractSSRs(freeSSR),
//       ...extractSSRs(paidSSR)
//     ];
//   }

// _extractFlightSSRs(freeSSR, paidSSR, flightNumber) {
//     const extractSSRs = (ssrData) => {
//       if (!ssrData.Trips?.[0]?.Journey?.[0]?.Segments) {
//         return [];
//       }

//       return ssrData.Trips[0].Journey.reduce((acc, journey) => {
//         const segmentSSRs = journey.Segments
//           ?.filter(segment => !flightNumber || segment.FUID === flightNumber)
//           ?.flatMap(segment => segment.SSR || [])
//           ?.map(ssr => ({
//             ...ssr,
//             isPaid: Boolean(ssr.Charge > 0)
//           })) || [];
        
//         return [...acc, ...segmentSSRs];
//       }, []);
//     };

//     const freeSSRs = extractSSRs(freeSSR);
//     const paidSSRs = extractSSRs(paidSSR);
//     console.log('Free SSR response:', JSON.stringify(freeSSR, null, 2));
// console.log('Paid SSR response:', JSON.stringify(paidSSR, null, 2));

//     // Debug logging
//     logger.debug(`Free SSRs: ${JSON.stringify(freeSSRs)}`);
//     logger.debug(`Paid SSRs: ${JSON.stringify(paidSSRs)}`);

//     return [...freeSSRs, ...paidSSRs];
//   }
  _extractFlightSSRs(freeSSR, paidSSR, flightNumber) {
    const extractSSRs = (ssrData) => {
      if (!ssrData?.Trips?.[0]?.Journey?.[0]?.Segments) {
        logger.debug('No segments found in SSR data');
        return [];
      }

      const segments = ssrData.Trips[0].Journey[0].Segments;
      return segments
        // .filter(segment => !flightNumber || segment.FUID === flightNumber)
        .flatMap(segment => 
          (segment.SSR || []).map(ssr => ({
            ...ssr,
            isPaid: Boolean(ssr.Charge > 0)
          }))
        );
    };

    const freeSSRs = extractSSRs(freeSSR);
    const paidSSRs = extractSSRs(paidSSR);
    
    logger.debug(`Extracted Free SSRs: ${JSON.stringify(freeSSRs.length)} items`);
    logger.debug(`Extracted Paid SSRs: ${JSON.stringify(paidSSRs.length)} items`);

    return [...freeSSRs, ...paidSSRs];
  }
//   _categorizeSSRs(ssrs) {
//     const categories = {
//       MEALS: [],
//       BAGGAGE: [],
//       SPORTS: [],
//       PRIORITY: [],
//       SEATS: [],
//       OTHER: []
//     };

//     ssrs.forEach(ssr => {
//       switch (ssr.Type) {
//         case '1':
//           categories.MEALS.push(ssr);
//           break;
//         case '2':
//           categories.BAGGAGE.push(ssr);
//           break;
//         case '3':
//           categories.SPORTS.push(ssr);
//           break;
//         case '7':
//         case '8':
//           categories.PRIORITY.push(ssr);
//           break;
//         case '9':
//           categories.SEATS.push(ssr);
//           break;
//         default:
//           categories.OTHER.push(ssr);
//       }
//     });

//     return categories;
//   }

// _categorizeSSRs(ssrs) {
//     // Debug logging
//     logger.debug(`Categorizing SSRs: ${JSON.stringify(ssrs)}`);

//     const categories = {
//       MEALS: [],
//       BAGGAGE: [],
//       SPORTS: [],
//       PRIORITY: [],
//       SEATS: [],
//       OTHER: []
//     };

//     if (!Array.isArray(ssrs)) {
//       logger.error('SSRs is not an array:', ssrs);
//       return categories;
//     }

//     ssrs.forEach(ssr => {
//       if (!ssr || !ssr.Type) {
//         logger.warn('Invalid SSR object:', ssr);
//         return;
//       }

//       switch (ssr.Type) {
//         case '1':
//           categories.MEALS.push(ssr);
//           break;
//         case '2':
//           categories.BAGGAGE.push(ssr);
//           break;
//         case '3':
//           categories.SPORTS.push(ssr);
//           break;
//         case '7':
//         case '8':
//           categories.PRIORITY.push(ssr);
//           break;
//         case '9':
//           categories.SEATS.push(ssr);
//           break;
//         default:
//           categories.OTHER.push(ssr);
//       }
//     });

//     // After categorizing:
    
//     // Debug logging
//     logger.debug(`Categorized SSRs: ${JSON.stringify(categories)}`);
    
//     return categories;
// }

_categorizeSSRs(ssrs) {
    logger.debug(`Categorizing ${ssrs.length} SSRs`);

    const categories = {
      MEALS: [],
      BAGGAGE: [],
      SPORTS: [],
      PRIORITY: [],
      SEATS: [],
      OTHER: []
    };

    if (!Array.isArray(ssrs)) {
      logger.error('SSRs is not an array:', ssrs);
      return categories;
    }

    ssrs.forEach(ssr => {
      if (!ssr || typeof ssr.Type === 'undefined') {
        logger.warn('Invalid SSR object:', ssr);
        return;
      }

      switch (ssr.Type) {
        case '1':
          categories.MEALS.push(ssr);
          break;
        case '2':
          categories.BAGGAGE.push(ssr);
          break;
        case '3':
          categories.SPORTS.push(ssr);
          break;
        case '7':
        case '8':
          categories.PRIORITY.push(ssr);
          break;
        case '9':
          categories.SEATS.push(ssr);
          break;
        default:
          categories.OTHER.push(ssr);
      }
    });

    // Log category counts for debugging
    Object.entries(categories).forEach(([category, items]) => {
      logger.debug(`${category}: ${items.length} items`);
    });

    return categories;
  }

  async _validateSSRs(selectedSSRs, availableSSRs) {
    return selectedSSRs.map(selected => {
      const availableSSR = availableSSRs.find(ssr => 
        ssr.Code === selected.code && 
        ssr.ID === selected.id
      );

      if (!availableSSR) {
        return {
          ssrCode: selected.code,
          valid: false,
          error: 'SSR not found'
        };
      }

      // Validate price if it's a paid SSR
      if (availableSSR.isPaid && availableSSR.Charge !== selected.amount) {
        return {
          ssrCode: selected.code,
          valid: false,
          error: 'Invalid SSR amount'
        };
      }

      return {
        ssrCode: selected.code,
        valid: true
      };
    });
  }
}

module.exports = new SSRController();