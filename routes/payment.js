const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const Joi = require('joi');

// Payment validation schemas
const initiatePaymentSchema = {
    amount: Joi.number().min(100).max(1000000).required()
        .messages({
            'number.base': 'Amount must be a number',
            'number.min': 'Minimum payment amount is ₦100',
            'number.max': 'Maximum payment amount is ₦1,000,000',
            'any.required': 'Amount is required'
        }),
    redirect_url: Joi.string().uri().optional()
        .messages({
            'string.uri': 'Redirect URL must be a valid URL'
        })
};

// All payment routes require authentication
router.use(authMiddleware);

// Initiate payment (create payment link)
router.post('/initiate', 
    validateRequest(initiatePaymentSchema), 
    paymentController.initiatePayment
);

// Handle payment callback/success
router.get('/callback', paymentController.handlePaymentCallback);

// Get payment status by transaction reference
router.get('/status/:tx_ref', paymentController.getPaymentStatus);

// Verify payment (for callback handling)
router.post('/verify', 
    validateRequest({ tx_ref: Joi.string().required() }), 
    paymentController.handlePaymentCallback
);

module.exports = router;
