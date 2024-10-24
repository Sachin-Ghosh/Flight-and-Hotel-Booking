// config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        // Log the full error for debugging
        console.error(error);
        process.exit(1);
    }
};

module.exports = connectDB;


// // db.js
// const mongoose = require('mongoose');
// const { createLogger } = require('../utils/logger');

// const logger = createLogger('Database');

// const dbConfig = {
//   url: process.env.MONGO_URI || 'mongodb://localhost:27017/flight_booking',
//   options: {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     maxPoolSize: 10,
//     serverSelectionTimeoutMS: 5000,
//     socketTimeoutMS: 45000,
//     family: 4
//   }
// };

// // Connect to MongoDB
// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(dbConfig.url, dbConfig.options);
//     logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
//     // Handle connection events
//     mongoose.connection.on('error', err => {
//       logger.error('MongoDB connection error:', err);
//     });

//     mongoose.connection.on('disconnected', () => {
//       logger.warn('MongoDB disconnected. Attempting to reconnect...');
//     });

//     return conn;
//   } catch (error) {
//     logger.error('Database connection failed:', error);
//     process.exit(1);
//   }
// };

// module.exports = {
//   dbConfig,
//   connectDB
// };