// // searchService.js
const axios = require('axios');
const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('./signatureService');

const logger = createLogger('SearchService');

class SearchService {
  constructor() {
    this.SEARCH_TIMEOUT = 48000;     // 48 seconds (allowing 2s buffer)
    this.INITIAL_POLL_INTERVAL = 1000; // Start with 1 second
    this.MAX_POLL_INTERVAL = 5000;    // Max 5 seconds between polls
    this.MAX_RETRIES = 3;
  }

  async initiateSearch(searchParams) {
    try {
      const credentials = await signatureService.getCredentials();
      const searchPayload = this._buildSearchPayload(searchParams, credentials);
      
      logger.info('Initiating flight search with params:', { 
        origin: searchParams.origin || searchParams.from,
        destination: searchParams.destination || searchParams.to 
      });

      const searchResponse = await this._makeRequest(
        'POST',
        `${BENZY_CONFIG.baseUrls.flights}/flights/ExpressSearch`,
        searchPayload,
        credentials.token,
        10000 // 10s timeout for initial request
      );

      if (!searchResponse.TUI) {
        throw new ApiError(500, 'Invalid search response - missing TUI');
      }

      const cleanTUI = this._cleanString(searchResponse.TUI);
      const cleanClientId = this._cleanString(credentials.clientId);

      logger.info('Search initiated successfully, starting polling', { TUI: cleanTUI });

      const results = await this._pollForResultsWithBackoff(
        cleanTUI,
        credentials.token,
        cleanClientId
      );

      return {
        success: true,
        fromCache: false,
        data: this._processSearchResults(results),
        TUI: cleanTUI
      };

    } catch (error) {
      logger.error('Search error:', error);
      if (error.message?.includes('timeout')) {
        throw new ApiError(408, 'Search timeout - please try again');
      }
      throw error instanceof ApiError ? error : new ApiError(500, 'Flight search failed', error);
    }
  }

  async _pollForResultsWithBackoff(TUI, token, clientId) {
    const startTime = Date.now();
    let pollInterval = this.INITIAL_POLL_INTERVAL;
    let attempt = 1;
    let lastError = null;

    while (Date.now() - startTime < this.SEARCH_TIMEOUT) {
      try {
        const results = await this.getSearchResults(TUI, token, clientId);
        
        if (results.Completed === "True" || results.completed === true) {
          logger.info('Search completed successfully', { TUI });
          return results;
        }

        // Calculate next poll interval with exponential backoff
        pollInterval = Math.min(pollInterval * 1.5, this.MAX_POLL_INTERVAL);
        
        // Check remaining time before waiting
        const remainingTime = this.SEARCH_TIMEOUT - (Date.now() - startTime);
        if (remainingTime <= 0) {
          throw new ApiError(408, 'Search timeout - exceeded time limit');
        }

        // Wait for shorter of poll interval or remaining time
        const waitTime = Math.min(pollInterval, remainingTime);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempt++;

      } catch (error) {
        lastError = error;
        logger.warn(`Polling attempt ${attempt} failed`, { error: error.message });

        if (attempt >= this.MAX_RETRIES) {
          throw new ApiError(error.statusCode || 500, 
            'Search failed after maximum retries', lastError);
        }

        // Exponential backoff for errors
        pollInterval = Math.min(pollInterval * 2, this.MAX_POLL_INTERVAL);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempt++;
      }
    }

    throw new ApiError(408, 'Search timeout - exceeded time limit');
  }

  async getSearchResults(TUI, token, clientId) {
    const payload = {
      ClientID: this._cleanString(clientId),
      TUI: this._cleanString(TUI)
    };

    return await this._makeRequest(
      'POST',
      `${BENZY_CONFIG.baseUrls.flights}/flights/GetExpSearch`,
      payload,
      token,
      8000 // 8s timeout for polling requests
    );
  }

  async _makeRequest(method, url, data, token, timeout = 10000) {
    const config = {
      method,
      url,
      data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout,
    };

    try {
      const response = await axios(config);

      if (!response.data || response.data.Code !== "200") {
        throw new ApiError(
          response.data?.Code || 500,
          response.data?.Msg?.[0] || 'API request failed'
        );
      }

      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new ApiError(408, 'Request timeout', error);
        }
        throw new ApiError(
          error.response?.status || 500,
          error.response?.data?.Msg?.[0] || 'API request failed',
          error
        );
      }
      throw error;
    }
  }

_cleanString(str) {
  // Remove escape characters and trim
  return str?.replace(/\\"/g, '"')
            .replace(/\\/g, '')
            .replace(/^"/, '')
            .replace(/"$/, '')
            .trim() || '';
}
  _buildSearchPayload(searchParams, credentials) {
    return {
        FareType: this._getFareType(searchParams.tripType),
        ADT: parseInt(searchParams.adults) || 1,
        CHD: parseInt(searchParams.children) || 0,
        INF: parseInt(searchParams.infants) || 0,
        Cabin: this._getCabinClass(searchParams.cabinClass),
        Source: "CF",
        Mode: "AS",
        ClientID: this._cleanString(credentials.clientId),
        IsMultipleCarrier: searchParams.isMultipleCarrier,
        IsRefundable: searchParams.refundableOnly,
        preferedAirlines: searchParams.airlines || searchParams.preferredAirlines || null,
        TUI: "",
        SecType: "",
        Trips: [
          {
            From: searchParams.origin,
            To: searchParams.destination,
            ReturnDate: searchParams.returnDate || "",
            OnwardDate: searchParams.departureDate,
            TUI: ""
          }
        ],
        Parameters: {
          Airlines: Array.isArray(searchParams.airlines) ? searchParams.airlines.join(',') : "",
          GroupType: searchParams.groupType,
          Refundable: (searchParams.refundableOnly ? "Y" : "N" || ""),
          IsDirect: searchParams.directOnly,
          IsStudentFare: searchParams.isStudentFare,
          IsNearbyAirport: searchParams.isNearbyAirport,
          IsExtendedSearch: searchParams.isExtendedSearch
        }
      };
  }

  _getFareType(tripType) {
    const fareTypes = {
      'oneway': 'ON',
      'roundtrip': 'RT',
      'multicity': 'IM'  // Assuming international multicity by default
    };
    return fareTypes[tripType?.toLowerCase()] || 'ON';
  }

  _getCabinClass(cabin) {
    const cabinMap = {
      'economy': 'E',
      'business': 'B',
      'first': 'F',
      'premium_economy': 'PE',
      // Also support direct cabin codes
      'E': 'E',
      'B': 'B',
      'F': 'F',
      'PE': 'PE'
    };
    return cabinMap[cabin?.toLowerCase()] || 'E';
  }

  _processSearchResults(results) {
    if (!results?.Trips?.length) {
      return [];
    }
 const globalNotices = results.Notices?.map(notice => ({
        message: notice.Notice,
        link: notice.Link,
        type: notice.NoticeType
      })) || [];
    
      return results.Trips.map(trip => ({
        flights: trip.Journey.map(flight => ({
          flightNumber: flight.FlightNo?.trim(),
          provider: flight.Provider,
          airline: {
            code: flight.VAC,
            name: flight.AirlineName?.split('|')[0],
            marketingCarrier: flight.MAC,
            operatingCarrier: flight.OAC
          },
          route: {
            departure: {
              airport: {
                code: flight.From,
                name: flight.FromName?.split('|')[0],
                location: flight.FromName?.split('|')[1]?.trim()
              },
              terminal: flight.DepartureTerminal,
              scheduledTime: new Date(flight.DepartureTime)
            },
            arrival: {
              airport: {
                code: flight.To,
                name: flight.ToName?.split('|')[0],
                location: flight.ToName?.split('|')[1]?.trim()
              },
              terminal: flight.ArrivalTerminal,
              scheduledTime: new Date(flight.ArrivalTime)
            },
            duration: flight.Duration?.trim(),
            stops: {
              count: flight.Stops,
              connections: flight.Connections?.map(conn => ({
                airport: {
                  code: conn.Airport,
                  name: conn.ArrAirportName?.split('|')[0],
                  location: conn.ArrAirportName?.split('|')[1]?.trim()
                },
                duration: conn.Duration?.trim(),
                type: conn.Type
              }))
            }
          },
          aircraft: {
            type: flight.AirCraft,
            code: flight.RBD,
            fareClass: flight.FareClass,
            cabin: flight.Cabin
          },
          pricing: {
            currency: results.CurrencyCode,
            gross: flight.GrossFare,
            net: flight.NetFare,
            commission: flight.TotalCommission,
            transactionFee: flight.TotalTransactionFee,
            vatOnFee: flight.TotalVatOnTFee,
            wpNet: flight.WPNetFare,
            fareBasicCode: flight.FBC,
            fareType: flight.FareType,
            trendFare: flight.TrendFare,
            promo: flight.Promo
          },
          availability: {
            seats: flight.Seats,
            refundable: flight.Refundable === "Y",
            hold: flight.Hold,
            holdInfo: flight.HoldInfo
          },
          amenities: flight.Amenities?.split(','),
          inclusions: {
            baggage: flight.Inclusions?.Baggage,
            meals: flight.Inclusions?.Meals,
            pieceDescription: flight.Inclusions?.PieceDescription
          },
          notices: [
            ...(flight.Notice ? [{
              message: flight.Notice,
              link: flight.NoticeLink,
              type: flight.NoticeType
            }] : []),
            ...globalNotices
          ],
          grouping: {
            returnIdentifier: flight.ReturnIdentifier,
            groupCount: flight.GroupCount,
            journeyKey: flight.JourneyKey,
            index: flight.Index
          },
          meta: {
            gfl: flight.GFL,
            recommended: flight.Recommended,
            gsdPriority: flight.GDSPriority,
            isBusStation: flight.IsBusStation,
            channelCode: flight.ChannelCode
          }
        }))
      }));
  }
}

module.exports = new SearchService();
