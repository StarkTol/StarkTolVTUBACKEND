const express = require('express');
const router = express.Router();
const resellerController = require('../controllers/resellerController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// All reseller routes require authentication
router.use(authMiddleware);

// Application route (any user can apply)
router.post('/apply', validateRequest('resellerApplication'), resellerController.applyForReseller);

// Reseller-only routes
router.get('/dashboard', roleMiddleware(['reseller']), resellerController.getResellerDashboard);
router.get('/pricing', roleMiddleware(['reseller']), resellerController.getResellerPricing);
router.get('/commissions', roleMiddleware(['reseller']), resellerController.getCommissions);

// Sub-reseller management
router.post('/sub-resellers', roleMiddleware(['reseller']), validateRequest('createSubReseller'), resellerController.createSubReseller);
router.get('/sub-resellers', roleMiddleware(['reseller']), resellerController.getSubResellers);
router.put('/sub-resellers/:sub_reseller_id/commission', roleMiddleware(['reseller']), validateRequest('updateCommission'), resellerController.updateSubResellerCommission);
router.put('/sub-resellers/:sub_reseller_id/deactivate', roleMiddleware(['reseller']), resellerController.deactivateSubReseller);

module.exports = router;
