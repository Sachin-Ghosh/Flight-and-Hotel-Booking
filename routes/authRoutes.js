// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const UserAuthController = require('../controllers/auth/userAuth');
const { validateRequest } = require('../middleware/validationMiddleware');
const { authGuard } = require('../middleware/authMiddleware');

// User authentication routes
router.post('/register', validateRequest('register'), UserAuthController.register);
router.post('/verify-email', validateRequest('verifyEmail'), UserAuthController.verifyEmail);
router.post('/login', validateRequest('login'), UserAuthController.login);
router.post('/verify-login', validateRequest('verifyLoginOTP'), UserAuthController.verifyLoginOTP);
router.post('/logout', authGuard, UserAuthController.logout);

module.exports = router;