const axios = require('axios');
const cron = require('node-cron');

// Your website URL to request
const websiteUrl = 'https://home-ease-m1t9.onrender.com';

// Function to make the website request
const makeRequest = async () => {
  try {
    const response = await axios.get(websiteUrl);
    console.log(`Request to ${websiteUrl} successful. Response:`, response.data);
  } catch (error) {
    console.error(`Error making request to ${websiteUrl}:`, error.message);
  }
};

// Schedule the cron job to run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('Running the cron job to request the website...');
  await makeRequest();
});