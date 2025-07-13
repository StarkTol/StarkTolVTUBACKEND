const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Referral routes - all require authentication
router.use(authMiddleware);

router.get('/info', referralController.getReferralInfo);
router.get('/', referralController.getReferrals);
router.get('/earnings', referralController.getReferralEarnings);
router.get('/leaderboard', referralController.getReferralLeaderboard);

router.post('/generate-code', referralController.generateNewReferralCode);
router.post('/process-bonus', validateRequest('processReferralBonus'), referralController.processReferralBonus);
router.post('/withdraw-earnings', validateRequest('withdrawReferralEarnings'), referralController.withdrawReferralEarnings);

module.exports = router;
