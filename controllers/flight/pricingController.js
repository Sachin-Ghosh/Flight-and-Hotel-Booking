const { createLogger } = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const BENZY_CONFIG = require('../../config/benzyConfig');
const signatureService = require('../../services/benzy/signatureService');
const axios = require('axios');

const logger = createLogger('FlightPricingController');

class FlightPricingController {
    constructor() {
        this.getLivePrice = this.getLivePrice.bind(this);
        this._makeRequest = this._makeRequest.bind(this);
        this._processResponse = this._processResponse.bind(this);
        this._handlePriceChange = this._handlePriceChange.bind(this);
    }

    /**
     * Handles price change scenarios from the API
     */
    _handlePriceChange(response) {
        const priceChangeDetails = {
            hasPriceChanged: false,
            code: response.Code,
            messages: response.Msg,
            previousAmount: null,
            newAmount: null
        };

        // Check if there's a price change message (Code 1500)
        if (response.Code === '1500' && response.Msg && response.Msg.length > 0) {
            priceChangeDetails.hasPriceChanged = true;
            
            // Parse price change from message
            const priceChangeMsg = response.Msg[0];
            const priceMatch = priceChangeMsg.match(/Previous Amt:-([\d.]+) \| New Amt:-([\d.]+)/);
            
            if (priceMatch) {
                priceChangeDetails.previousAmount = parseFloat(priceMatch[1]);
                priceChangeDetails.newAmount = parseFloat(priceMatch[2]);
            }
        }

        return priceChangeDetails;
    }

    /**
     * Get live pricing details in a single request
     */
    async getLivePrice(req, res, next) {
        try {
            const { amount, index, tripType = 'ON', tui, orderId } = req.body;

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
                    OrderID: orderId,
                    TUI: tui
                }],
                Mode: 'SS', // Semi-synchronous mode
                Options: '',
                Source: 'SF', // Cache first
                TripType: tripType
            };

            const smartPricerResponse = await this._makeRequest(
                'POST',
                `${BENZY_CONFIG.baseUrls.flights}/Flights/SmartPricer`,
                smartPricerPayload,
                token
            );

            const TUI = smartPricerResponse.TUI;

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

            // Process the response and handle price changes
            const processedResponse = this._processResponse(livePricingResponse);
            const priceChangeDetails = this._handlePriceChange(livePricingResponse);

            return res.json({
                success: true,
                data: {
                    ...processedResponse,
                    priceChange: priceChangeDetails
                }
            });

        } catch (error) {
            logger.error('Live pricing error:', error);
            next(error);
        }
    }

    async _makeRequest(method, url, data, token) {
        try {
            const response = await axios({
                method,
                url,
                data,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Handle API-level errors
            if (response.data.Code && response.data.Code !== '200' && !['1500'].includes(response.data.Code)) {
                throw new ApiError(
                    parseInt(response.data.Code) || 500,
                    response.data.Msg?.[0] || 'API request failed',
                    response.data
                  );
                }
                
                // console.log(response)
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
        // Include all segments in the flights array for multi-leg journeys
        const processFlights = (trips) => {
            if (!trips || !trips.length) return [];
            
            return trips.map(trip => {
                const journey = trip.Journey?.[0];
                if (!journey) return null;

                return {
                    provider: journey.Provider,
                    duration: journey.Duration,
                    stops: parseInt(journey.Stops),
                    segments: journey.Segments.map(segment => ({
                        flight: {
                            number: segment.Flight?.FlightNo,
                            airline: segment.Flight?.Airline?.split('|')[0],
                            aircraft: segment.Flight?.AirCraft
                        },
                        departure: {
                            airport: segment.Flight?.DepartureCode,
                            terminal: segment.Flight?.DepartureTerminal,
                            time: segment.Flight?.DepartureTime
                        },
                        arrival: {
                            airport: segment.Flight?.ArrivalCode,
                            terminal: segment.Flight?.ArrivalTerminal,
                            time: segment.Flight?.ArrivalTime
                        },
                        fareDetails: {
                            baseFare: segment.Fares?.TotalBaseFare,
                            taxes: segment.Fares?.TotalTax,
                            grossFare: segment.Fares?.GrossFare
                        }
                    }))
                };
            }).filter(Boolean);
        };

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
                currency: response.CurrencyCode || 'INR',
                netAmount: response.NetAmount,
                grossAmount: response.GrossAmount,
                insurancePremium: response.InsPremium
            },
            flights: processFlights(response.Trips),
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
            })),
            ssr: response.SSR?.map(ssr => ({
                code: ssr.Code,
                description: ssr.Description,
                charge: ssr.Charge,
                type: ssr.Type
            }))
        };
    }
}

// Export a single instance
const flightPricingController = new FlightPricingController();
module.exports = flightPricingController;