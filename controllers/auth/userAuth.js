const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../../utils/logger');
const { sendEmail } = require('../../services/emailService');
const { generateOTP, validateEmail } = require('../../utils/validators');
const { JWT_SECRET, OTP_EXPIRY } = require('../../config/authConfig');

const logger = createLogger('UserAuth');

class UserAuthController {
  async register(req, res) {
    try {
      const { email, firstName, lastName, phone, password } = req.body;

      // Validate email format
      if (!validateEmail(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid email format' 
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: 'Email already registered' 
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY);

      // Create user with verification details
      const user = new User({
        email,
        password,
        profile: { firstName, lastName, phone },
        verification: {
          email: {
            token: otp,
            expiresAt: otpExpiry
          }
        }
      });

      await user.save();

    //   // Send verification email
    //   await sendEmail({
    //     to: email,
    //     subject: 'Verify Your Email',
    //     template: 'email-verification',
    //     data: {
    //       name: firstName,
    //       otp
    //     }
    //   });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: {
          userId: user._id,
          email: user.email,
          otp: user.verification.email.token
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Registration failed' 
      });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { email, otp } = req.body;

      const user = await User.findOne({
        email,
        'verification.email.token': otp,
        'verification.email.expiresAt': { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Update user verification status
      user.verification.email.verified = true;
      user.verification.email.token = null;
      user.verification.email.expiresAt = null;
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: { token }
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email verification failed'
      });
    }
  }

  async login(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.verification.email.verified) {
        return res.status(403).json({
          success: false,
          message: 'Email not verified'
        });
      }

      // Generate OTP for login
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY);

      user.verification.email.token = otp;
      user.verification.email.expiresAt = otpExpiry;
      await user.save();

    //   // Send login OTP email
    //   await sendEmail({
    //     to: email,
    //     subject: 'Login OTP',
    //     template: 'login-otp',
    //     data: {
    //       name: user.profile.firstName,
    //       otp
    //     }
    //   });

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
        otp: user.verification.email.token
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  async verifyLoginOTP(req, res) {
    try {
      const { email, otp } = req.body;

      const user = await User.findOne({
        email,
        'verification.email.token': otp,
        'verification.email.expiresAt': { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Clear OTP
      user.verification.email.token = null;
      user.verification.email.expiresAt = null;
      
      // Update security info
      user.security.lastLogin = new Date();
      user.security.loginAttempts = 0;
      
      // Add session info
      const sessionToken = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      user.security.sessions.push({
        token: sessionToken,
        deviceInfo: req.headers['user-agent'],
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token: sessionToken,
          user: {
            id: user._id,
            email: user.email,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName
          }
        }
      });
    } catch (error) {
      logger.error('Login verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Login verification failed'
      });
    }
  }

  async logout(req, res) {
    try {
      const { userId } = req.user;
      const token = req.headers.authorization?.split(' ')[1];

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove current session
      user.security.sessions = user.security.sessions.filter(
        session => session.token !== token
      );
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }
}

module.exports = new UserAuthController();