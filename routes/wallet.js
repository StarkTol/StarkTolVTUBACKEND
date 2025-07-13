const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Wallet routes - all require authentication
router.use(authMiddleware);

router.get('/', walletController.getWallet);
router.post('/deposit', validateRequest('deposit'), walletController.deposit);
router.post('/withdraw', validateRequest('withdraw'), walletController.withdraw);
router.post('/transfer', validateRequest('transfer'), walletController.transfer);

module.exports = router;
