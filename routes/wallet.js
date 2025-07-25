const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Wallet routes - all require authentication
router.use(authMiddleware);

// Get wallet balance and details
router.get('/', walletController.getWallet);
router.get('/balance', walletController.getWallet);

// Fund wallet with various payment methods (including Flutterwave)
router.post('/fund', walletController.fundWallet);

// Legacy deposit route
router.post('/deposit', validateRequest('deposit'), walletController.deposit);

// Withdraw and transfer
router.post('/withdraw', validateRequest('withdraw'), walletController.withdraw);
router.post('/transfer', validateRequest('transfer'), walletController.transfer);

module.exports = router;
