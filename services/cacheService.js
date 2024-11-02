// services/cacheService.js
const redis = require('../config/redis');
const { createLogger } = require('../utils/logger');
const { ApiError } = require('../utils/errors');

const logger = createLogger('CacheService', 'FlightCacheService');

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serializedValue = JSON.stringify(value);
      await redis.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success status
   */
  async delete(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set cache with callback
   * @param {string} key - Cache key
   * @param {Function} callback - Function to get data if cache miss
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - Data from cache or callback
   */
  async getOrSet(key, callback, ttl = this.defaultTTL) {
    try {
      const cached = await this.get(key);
      if (cached) {
        return cached;
      }

      const freshData = await callback();
      await this.set(key, freshData, ttl);
      return freshData;
    } catch (error) {
      logger.error(`Error in getOrSet for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set multiple values in cache
   * @param {Object} keyValues - Object with key-value pairs
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async mset(keyValues, ttl = this.defaultTTL) {
    try {
      const pipeline = redis.pipeline();
      
      Object.entries(keyValues).forEach(([key, value]) => {
        pipeline.setex(key, ttl, JSON.stringify(value));
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Error setting multiple cache values:', error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<Object>} - Object with key-value pairs
   */
  async mget(keys) {
    try {
      const values = await redis.mget(keys);
      return keys.reduce((acc, key, index) => {
        const value = values[index];
        acc[key] = value ? JSON.parse(value) : null;
        return acc;
      }, {});
    } catch (error) {
      logger.error('Error getting multiple cache values:', error);
      return {};
    }
  }

  /**
   * Clear all cache with prefix
   * @param {string} prefix - Key prefix to clear
   * @returns {Promise<boolean>} - Success status
   */
  async clearByPrefix(prefix) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
      return true;
    } catch (error) {
      logger.error(`Error clearing cache with prefix ${prefix}:`, error);
      return false;
    }
  }
}



// const logger = createLogger('FlightCacheService');

class FlightCacheService {
  constructor() {
    this.cacheService = new CacheService(); 
    this.CACHE_DURATION = {
      SEARCH_RESULTS: 300, // 5 minutes
      FLIGHT_DETAILS: 3600, // 1 hour
      FARE_RULES: 1800, // 30 minutes
      SEAT_MAP: 900, // 15 minutes
      BAGGAGE_INFO: 3600 // 1 hour
    };
    this.CACHE_PREFIX = {
      SEARCH: 'flight:search:',
      DETAILS: 'flight:details:',
      FARE: 'flight:fare:',
      SEAT: 'flight:seat:',
      BAGGAGE: 'flight:baggage:'
    };
  }

  /**
   * Generate cache key for flight search
   * @param {Object} searchParams - Search parameters
   * @returns {string} Cache key
   */
  _generateSearchKey(searchParams) {
    const normalizedParams = {
      tripType: searchParams.tripType?.toLowerCase(),
      from: searchParams.from?.toUpperCase(),
      to: searchParams.to?.toUpperCase(),
      departDate: searchParams.departDate,
      returnDate: searchParams.returnDate,
      adults: parseInt(searchParams.adults) || 1,
      children: parseInt(searchParams.children) || 0,
      infants: parseInt(searchParams.infants) || 0,
      cabinClass: searchParams.cabinClass?.toLowerCase(),
      airlines: (searchParams.airlines || []).sort().join(','),
      directOnly: !!searchParams.directOnly,
      refundableOnly: !!searchParams.refundableOnly
    };

    return `${this.CACHE_PREFIX.SEARCH}${JSON.stringify(normalizedParams)}`;
  }

  /**
   * Cache flight search results
   * @param {Object} searchParams - Search parameters
   * @param {Object} results - Search results
   * @returns {Promise<void>}
   */
  async cacheSearchResults(searchParams, results) {
    try {
      const key = this._generateSearchKey(searchParams);
      const cacheData = {
        timestamp: Date.now(),
        results,
        params: searchParams
      };

      await redis.setex(key, this.CACHE_DURATION.SEARCH_RESULTS, JSON.stringify(cacheData));
      logger.info(`Cached search results for key: ${key}`);
    } catch (error) {
      logger.error('Error caching search results:', error);
      // Don't throw error as caching failure shouldn't affect the main flow
    }
  }

  /**
   * Get cached flight search results
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object|null>} Cached results or null
   */
  async getCachedSearchResults(searchParams) {
    try {
      const key = this._generateSearchKey(searchParams);
      const cached = await redis.get(key);

      if (!cached) {
        return null;
      }

      const cachedData = JSON.parse(cached);
      const age = Date.now() - cachedData.timestamp;

      // Return null if cache is too old or parameters have changed
      if (age > this.CACHE_DURATION.SEARCH_RESULTS * 1000) {
        await redis.del(key);
        return null;
      }

      logger.info(`Cache hit for search key: ${key}`);
      return cachedData.results;
    } catch (error) {
      logger.error('Error retrieving cached search results:', error);
      return null;
    }
  }

  /**
   * Cache flight details
   * @param {string} flightId - Flight ID
   * @param {Object} details - Flight details
   * @returns {Promise<void>}
   */
  async cacheFlightDetails(flightId, details) {
    try {
      const key = `${this.CACHE_PREFIX.DETAILS}${flightId}`;
      await redis.setex(key, this.CACHE_DURATION.FLIGHT_DETAILS, JSON.stringify(details));
    } catch (error) {
      logger.error('Error caching flight details:', error);
    }
  }

  /**
   * Get cached flight details
   * @param {string} flightId - Flight ID
   * @returns {Promise<Object|null>} Cached details or null
   */
  async getCachedFlightDetails(flightId) {
    try {
      const key = `${this.CACHE_PREFIX.DETAILS}${flightId}`;
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error retrieving cached flight details:', error);
      return null;
    }
  }

  /**
   * Cache fare rules
   * @param {string} TUI - Transaction Unique ID
   * @param {string} FUID - Flight Unique ID
   * @param {Object} rules - Fare rules
   * @returns {Promise<void>}
   */
  async cacheFareRules(TUI, FUID, rules) {
    try {
      const key = `${this.CACHE_PREFIX.FARE}${TUI}:${FUID}`;
      await redis.setex(key, this.CACHE_DURATION.FARE_RULES, JSON.stringify(rules));
    } catch (error) {
      logger.error('Error caching fare rules:', error);
    }
  }

  /**
   * Clear expired cache entries
   * @returns {Promise<void>}
   */
  async clearExpiredCache() {
    try {
      const prefixes = Object.values(this.CACHE_PREFIX);
      for (const prefix of prefixes) {
        const keys = await redis.keys(`${prefix}*`);
        for (const key of keys) {
          const ttl = await redis.ttl(key);
          if (ttl <= 0) {
            await redis.del(key);
            logger.info(`Cleared expired cache key: ${key}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error clearing expired cache:', error);
    }
  }

  /**
   * Invalidate all flight-related cache
   * @returns {Promise<void>}
   */
  async invalidateAllCache() {
    try {
      const prefixes = Object.values(this.CACHE_PREFIX);
      for (const prefix of prefixes) {
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          await redis.del(keys);
          logger.info(`Invalidated cache with prefix: ${prefix}`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const stats = {};
      const prefixes = Object.values(this.CACHE_PREFIX);
      
      for (const prefix of prefixes) {
        const keys = await redis.keys(`${prefix}*`);
        stats[prefix] = {
          count: keys.length,
          size: 0,
          avgTTL: 0
        };

        if (keys.length > 0) {
          let totalSize = 0;
          let totalTTL = 0;

          for (const key of keys) {
            const [size, ttl] = await Promise.all([
              redis.memory('USAGE', key),
              redis.ttl(key)
            ]);
            totalSize += size;
            totalTTL += ttl;
          }

          stats[prefix].size = totalSize;
          stats[prefix].avgTTL = totalTTL / keys.length;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Error getting cache statistics:', error);
      return {};
    }
  }
}

// Export a singleton instance of CacheService as the default export
const defaultCacheService = new CacheService();

module.exports = defaultCacheService;

// Also export the classes if needed elsewhere
module.exports.CacheService = CacheService;
module.exports.FlightCacheService = FlightCacheService;
  