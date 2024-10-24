// // // redis.js
// // const Redis = require('ioredis');
// // const { createLogger } = require('../utils/logger');

// // const logger = createLogger('Redis');

// // const redisConfig = {
// //   host: process.env.REDIS_HOST || 'localhost',
// //   port: process.env.REDIS_PORT || 6379,
// //   password: process.env.REDIS_PASSWORD,
// //   db: process.env.REDIS_DB || 0,
// //   keyPrefix: 'flight_booking:',
// //   retryStrategy: (times) => {
// //     const delay = Math.min(times * 50, 2000);
// //     return delay;
// //   },
// //   maxRetriesPerRequest: 3
// // };

// // // Create Redis client
// // const redis = new Redis({
// //   ...redisConfig,
// //   lazyConnect: true,
// //   enableOfflineQueue: false
// // });

// // // Handle Redis events
// // redis.on('connect', () => {
// //   logger.info('Redis client connected');
// // });

// // redis.on('error', (error) => {
// //   logger.error('Redis client error:', error);
// // });

// // redis.on('close', () => {
// //   logger.warn('Redis connection closed');
// // });

// // // Graceful shutdown
// // process.on('SIGTERM', async () => {
// //   await redis.quit();
// //   logger.info('Redis connection closed through app termination');
// //   process.exit(0);
// // });

// // module.exports = redis;


// // config/redis.js
// const Redis = require('ioredis');
// const { createLogger } = require('../utils/logger');

// const logger = createLogger('Redis');

// const redisConfig = {
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   password: process.env.REDIS_PASSWORD,
//   db: process.env.REDIS_DB || 0,
//   keyPrefix: 'flight_booking:',
//   retryStrategy: (times) => {
//     const delay = Math.min(times * 50, 2000);
//     return delay;
//   },
//   maxRetriesPerRequest: 3,
//   reconnectOnError: (err) => {
//     const targetError = 'READONLY';
//     if (err.message.includes(targetError)) {
//       return true;
//     }
//     return false;
//   }
// };

// class RedisClient {
//   constructor() {
//     this.client = new Redis(redisConfig);
//     this.setupEventHandlers();
//   }

//   setupEventHandlers() {
//     this.client.on('connect', () => {
//       logger.info('Redis client connected');
//     });

//     this.client.on('error', (error) => {
//       logger.error('Redis client error:', error);
//     });

//     this.client.on('close', () => {
//       logger.warn('Redis connection closed');
//     });

//     this.client.on('reconnecting', () => {
//       logger.info('Redis client reconnecting');
//     });

//     process.on('SIGTERM', async () => {
//       await this.client.quit();
//       logger.info('Redis connection closed through app termination');
//       process.exit(0);
//     });
//   }

//   async ping() {
//     try {
//       const result = await this.client.ping();
//       return result === 'PONG';
//     } catch (error) {
//       logger.error('Redis ping failed:', error);
//       return false;
//     }
//   }
// }

// module.exports = new RedisClient().client;


const Redis = require('ioredis');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Redis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'flight_booking:',
  retryStrategy: (times) => {
    const maxRetryTime = 2000; // Maximum retry time in milliseconds
    const delay = Math.min(times * 50, maxRetryTime);
    logger.info(`Retrying Redis connection in ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000, // Connection timeout of 10 seconds
  enableOfflineQueue: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      logger.warn('Encountered READONLY error, attempting reconnection...');
      return true;
    }
    return false;
  }
};

class RedisClient {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      this.client = new Redis(redisConfig);
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (delay) => {
      logger.info(`Redis client reconnecting in ${delay}ms`);
    });

    this.client.on('ready', () => {
      logger.info('Redis client is ready to receive commands');
    });

    this.client.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  async gracefulShutdown() {
    try {
      await this.client.quit();
      logger.info('Redis connection closed through app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error during Redis shutdown:', error);
      process.exit(1);
    }
  }

  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  async healthCheck() {
    try {
      const startTime = Date.now();
      const isPong = await this.ping();
      const latency = Date.now() - startTime;
      
      return {
        status: isPong ? 'healthy' : 'unhealthy',
        latency: `${latency}ms`,
        connected: this.client.status === 'ready'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }
}

// Export a singleton instance
module.exports = new RedisClient().client;