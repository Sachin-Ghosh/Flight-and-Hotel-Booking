// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/authConfig');
const User = require('../models/userModel');
const Admin = require('../models/adminModel');
const { createLogger } = require('../utils/logger');
const { ResponseError } = require('../utils/response');

const logger = createLogger('AuthMiddleware');

// Verify JWT token and add user to request
exports.authGuard = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new ResponseError('Authorization token required', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      'security.sessions.token': token,
      'security.sessions.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      throw new ResponseError('Invalid or expired token', 401);
    }

    // Update last active timestamp
    await User.updateOne(
      { 
        _id: user._id,
        'security.sessions.token': token 
      },
      { 
        $set: { 
          'security.sessions.$.lastActive': new Date() 
        } 
      }
    );

    req.user = {
      userId: user._id,
      email: user.email,
      role: 'user'
    };
    
    next();
  } catch (error) {
    logger.error('Auth guard error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

// Admin authentication middleware
exports.adminGuard = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new ResponseError('Authorization token required', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({
      _id: decoded.adminId,
      'security.sessions.token': token,
      'security.sessions.expiresAt': { $gt: new Date() }
    });

    if (!admin) {
      throw new ResponseError('Invalid or expired token', 401);
    }

    // Update last active timestamp
    await Admin.updateOne(
      { 
        _id: admin._id,
        'security.sessions.token': token 
      },
      { 
        $set: { 
          'security.sessions.$.lastActive': new Date() 
        } 
      }
    );

    req.user = {
      adminId: admin._id,
      email: admin.email,
      role: 'admin',
      permissions: admin.permissions
    };
    
    next();
  } catch (error) {
    logger.error('Admin guard error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

// Role-based access control middleware
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (req.user.role !== 'admin') {
        throw new ResponseError('Admin access required', 403);
      }

      if (!req.user.permissions.includes(permission)) {
        throw new ResponseError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Permission check failed'
      });
    }
  };
};