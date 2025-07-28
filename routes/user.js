const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Profile routes
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, validateRequest('updateProfile'), userController.updateProfile);
router.put('/change-password', authMiddleware, validateRequest('changePassword'), userController.changePassword);

// Activity tracking routes
router.get('/activities', authMiddleware, userController.getLoginActivities);

module.exports = router;
