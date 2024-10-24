const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const axios = require('axios');

const logger = createLogger('FlightPricingController');

class FlightPricingController {
    constructor() {
        // Bind methods to the instance
        this.getLivePrice = this.getLivePrice.bind(this);
        this._makeRequest = this._makeRequest.bind(this);
        this._processResponse = this._processResponse.bind(this);
      }
  /**
   * Get live pricing details in a single request
   */
  async getLivePrice(req, res, next) {
    try {
      const { amount, index, tripType = 'ON',tui } = req.body;
       
      
      if (!amount || !index) {
        throw new ApiError(400, 'Amount and index are required');
      }

      const { clientId, token } = await signatureService.getCredentials();

      // Step 1: Get initial pricing and TUI
      const smartPricerPayload = {
        ClientID: clientId,
        Trips: [{
          Amount: parseFloat(amount),
          Index: index,
          OrderID: 1,
          TUI:tui
        }],
        Mode: 'SS', // Semi-synchronous mode
        Options: 'A',
        Source: 'CF', // Cache first
        TripType: tripType
      };
    //   console.log(smartPricerPayload);

      const smartPricerResponse = await this._makeRequest(
        'POST',
        `${BENZY_CONFIG.baseUrls.flights}/Flights/SmartPricer`,
        smartPricerPayload,
        token
      );

      const TUI = smartPricerResponse.TUI;
    //   console.log(smartPricerResponse);

      // Step 2: Get live pricing using TUI
      const livePricingPayload = {
        TUI,
        ClientID: clientId
      };

      const livePricingResponse = await this._makeRequest(
        'POST',
        `${BENZY_CONFIG.baseUrls.flights}/Flights/GetSPricer`,
        livePricingPayload,
        token
      );

      console.log(livePricingResponse);
      return res.json({
        success: true,
        data: this._processResponse(livePricingResponse)
      });

    } catch (error) {
      logger.error('Live pricing error:', error);
      next(error);
    }
  }

  async _makeRequest(method, url, data, token) {
    try {
        // console.log(method, url, data, token);
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(response.data)

      return response.data;
      

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          error.response?.status || 500,
          error.response?.data?.Msg?.[0] || 'Pricing request failed',
          error
        );
      }
      throw error;
    }
  }

  _processResponse(response) {
    // Transform the response into a cleaner format
    return {
      tui: response.TUI,
      route: {
        from: response.From,
        to: response.To,
        fromAirport: response.FromName,
        toAirport: response.ToName,
        onwardDate: response.OnwardDate,
        returnDate: response.ReturnDate
      },
      passengers: {
        adults: response.ADT,
        children: response.CHD,
        infants: response.INF
      },
      pricing: {
        currency: 'INR', // Assuming INR based on airports
        netAmount: response.NetAmount,
        grossAmount: response.GrossAmount,
        insurancePremium: response.InsPremium
      },
      flights: response.Trips?.map(trip => ({
        provider: trip.Journey?.[0]?.Provider,
        duration: trip.Journey?.[0]?.Duration,
        stops: parseInt(trip.Journey?.[0]?.Stops),
        flight: {
          number: trip.Journey?.[0]?.Segments?.[0]?.Flight?.FlightNo,
          airline: trip.Journey?.[0]?.Segments?.[0]?.Flight?.Airline?.split('|')[0],
          aircraft: trip.Journey?.[0]?.Segments?.[0]?.Flight?.AirCraft
        },
        departure: {
          airport: trip.Journey?.[0]?.Segments?.[0]?.Flight?.DepartureCode,
          terminal: trip.Journey?.[0]?.Segments?.[0]?.Flight?.DepartureTerminal,
          time: trip.Journey?.[0]?.Segments?.[0]?.Flight?.DepartureTime
        },
        arrival: {
          airport: trip.Journey?.[0]?.Segments?.[0]?.Flight?.ArrivalCode,
          terminal: trip.Journey?.[0]?.Segments?.[0]?.Flight?.ArrivalTerminal,
          time: trip.Journey?.[0]?.Segments?.[0]?.Flight?.ArrivalTime
        },
        fareDetails: {
          baseFare: trip.Journey?.[0]?.Segments?.[0]?.Fares?.TotalBaseFare,
          taxes: trip.Journey?.[0]?.Segments?.[0]?.Fares?.TotalTax,
          grossFare: trip.Journey?.[0]?.Segments?.[0]?.Fares?.GrossFare
        },
        baggage: response.SSR?.find(ssr => ssr.Code === 'BAG')?.Description
      })),
      rules: response.Rules?.map(rule => ({
        route: rule.OrginDestination,
        provider: rule.Provider,
        fees: rule.Rule?.map(r => ({
          type: r.Head,
          details: r.Info?.map(info => ({
            description: info.Description,
            adultAmount: info.AdultAmount,
            childAmount: info.ChildAmount,
            infantAmount: info.InfantAmount
          }))
        }))
      }))
    };
  }
}

// Export a single instance
const flightPricingController = new FlightPricingController();
module.exports = flightPricingController;