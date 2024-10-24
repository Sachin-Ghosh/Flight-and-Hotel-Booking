// signatureService.js
const axios = require('axios');
const { createLogger } = require('../../utils/logger');
const BENZY_CONFIG = require('../../config/benzyConfig');

const logger = createLogger('SignatureService');

class SignatureService {
    constructor() {
      this.token = null;
      this.tokenExpiry = null;
      this.clientId = null;
      this.TUI = null;
      this.isGenerating = false;
      this.pendingPromises = [];
    }
  
    async generateSignature() {
      try {
        // Implement request queuing to prevent multiple simultaneous signature requests
        if (this.isGenerating) {
          return new Promise((resolve, reject) => {
            this.pendingPromises.push({ resolve, reject });
          });
        }
  
        this.isGenerating = true;
  
        const response = await axios.post(
          `${BENZY_CONFIG.baseUrls.utils}/Utils/Signature`,
          {
            MerchantID: BENZY_CONFIG.merchantId,
            ApiKey: BENZY_CONFIG.apiKey,
            ClientID: BENZY_CONFIG.clientId,
            Password: BENZY_CONFIG.password,
            AgentCode: "",
            BrowserKey: BENZY_CONFIG.browserKey,
            Key: BENZY_CONFIG.key
          },
          {
            timeout: 10000 // 10 second timeout
          }
        );
  
        if (!response.data || response.data.Code !== "200") {
          throw new Error(response.data?.Msg || 'Invalid signature response');
        }
  
        this.token = response.data.Token;
        this.clientId = response.data.ClientID;
        this.TUI = response.data.TUI;
        this.tokenExpiry = Date.now() + (47 * 60 * 60 * 1000);
  
        const credentials = {
          token: this.token,
          clientId: this.clientId,
          TUI: this.TUI
        };
  
        // Resolve any pending promises
        this.pendingPromises.forEach(promise => promise.resolve(credentials));
        this.pendingPromises = [];
  
        return credentials;
      } catch (error) {
        this.pendingPromises.forEach(promise => promise.reject(error));
        this.pendingPromises = [];
        logger.error('Error generating signature:', error);
        throw error;
      } finally {
        this.isGenerating = false;
      }
    }
  
    async getCredentials() {
      try {
        if (!this.token || !this.tokenExpiry || this.tokenExpiry <= Date.now()) {
          return await this.generateSignature();
        }
  
        return {
          token: this.token,
          clientId: this.clientId,
          TUI: this.TUI
        };
      } catch (error) {
        logger.error('Error getting credentials:', error);
        throw new ApiError(500, 'Failed to obtain API credentials', error);
      }
    }
}

module.exports = new SignatureService();