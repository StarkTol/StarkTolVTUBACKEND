const express = require('express');
const router = express.Router();
const subdomainController = require('../controllers/subdomainController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Public subdomain resolution (no auth required)
router.get('/resolve/:subdomain', subdomainController.resolveSubdomain);

// Protected subdomain management routes
router.use(authMiddleware);
router.use(roleMiddleware(['reseller'])); // Only resellers can manage subdomains

router.get('/info', subdomainController.getSubdomainInfo);
router.post('/configure', validateRequest('configureSubdomain'), subdomainController.configureSubdomain);
router.post('/verify-domain', validateRequest('verifyDomain'), subdomainController.verifyCustomDomain);
router.get('/analytics', subdomainController.getSubdomainAnalytics);
router.put('/branding', validateRequest('updateBranding'), subdomainController.updateBranding);
router.put('/deactivate', subdomainController.deactivateSubdomain);

module.exports = router;
