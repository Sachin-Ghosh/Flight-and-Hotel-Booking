const dotenv = require('dotenv');

dotenv.config();

const BENZY_CONFIG = {
    merchantId: process.env.BENZY_MERCHANT_ID,
    apiKey: process.env.BENZY_API_KEY,
    clientId: process.env.BENZY_CLIENT_ID,
    password: process.env.BENZY_PASSWORD,
    browserKey: process.env.BENZY_BROWSER_KEY,
    key: process.env.BENZY_KEY,
    channelId: process.env.BENZY_CHANNEL_ID,
    baseUrls: {
      utils: process.env.BENZY_UTILS_API_URL,
      flights: process.env.BENZY_FLIGHTS_API_URL
    }
  };

module.exports = BENZY_CONFIG;
