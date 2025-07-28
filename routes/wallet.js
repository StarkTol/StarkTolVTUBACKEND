const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Webhook route (no authentication required)
router.post('/webhook', walletController.handleWebhook);

// Wallet routes - all require authentication
router.use(authMiddleware);

// Get wallet balance and details
router.get('/', walletController.getWallet);
router.get('/balance', walletController.getWallet);

// Fund wallet with various payment methods (including Flutterwave)
router.post('/fund', walletController.fundWallet);

// Deposit and verification routes
router.post('/deposit', validateRequest('deposit'), walletController.initiateDeposit);
router.post('/verify', walletController.verifyPayment);

// Withdraw and transfer
router.post('/withdraw', validateRequest('withdraw'), walletController.withdraw);
router.post('/transfer', validateRequest('transfer'), walletController.transfer);

// Get transaction history
router.get('/transactions', walletController.getTransactionHistory);

// Get wallet statistics
router.get('/stats', walletController.getWalletStats);

module.exports = router;
