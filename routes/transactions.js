const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Transaction routes - all require authentication
router.use(authMiddleware);

router.get('/', transactionController.getTransactions);
router.get('/stats', transactionController.getTransactionStats);
router.get('/recent', transactionController.getRecentTransactions);
router.get('/:id', transactionController.getTransaction);
router.get('/:id/receipt', transactionController.downloadReceipt);
router.post('/:id/retry', transactionController.retryTransaction);

module.exports = router;
