const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Public platform settings
router.get('/platform', settingsController.getPlatformSettings);

// User settings - require authentication
router.use(authMiddleware);

// User preferences
router.get('/preferences', settingsController.getUserPreferences);
router.put('/preferences', validateRequest('userPreferences'), settingsController.updateUserPreferences);

// Security settings
router.get('/security', settingsController.getSecuritySettings);
router.put('/security', validateRequest('securitySettings'), settingsController.updateSecuritySettings);

// API settings - reseller only
router.get('/api', roleMiddleware(['reseller']), settingsController.getAPISettings);
router.post('/api/regenerate', roleMiddleware(['reseller']), settingsController.regenerateAPICredentials);

// Webhook settings - reseller only
router.get('/webhooks', roleMiddleware(['reseller']), settingsController.getWebhookSettings);
router.put('/webhooks', roleMiddleware(['reseller']), validateRequest('webhookSettings'), settingsController.updateWebhookSettings);
router.post('/webhooks/test', roleMiddleware(['reseller']), settingsController.testWebhook);

module.exports = router;
