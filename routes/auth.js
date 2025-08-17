const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Authentication routes
router.post('/register', validateRequest('register'), authController.register);
router.get('/check-email', authController.checkEmail);
router.post('/login', validateRequest('login'), authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/refresh-token', authMiddleware, authController.refreshToken);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/activities', authMiddleware, authController.getActivities);
router.put('/profile', authMiddleware, validateRequest('updateProfile'), authController.updateProfile);
router.put('/change-password', authMiddleware, validateRequest('changePassword'), authController.changePassword);

module.exports = router;
