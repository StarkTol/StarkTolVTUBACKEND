const express = require('express');
const router = express.Router();
const vtuController = require('../controllers/vtuController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// VTU routes - all require authentication
router.use(authMiddleware);

// Network and service info routes
router.get('/networks', vtuController.getNetworks);
router.get('/data-plans/:network', vtuController.getDataPlans);
router.get('/cable-providers', vtuController.getCableProviders);
router.get('/cable-packages/:provider', vtuController.getCablePackages);
router.get('/electricity-providers', vtuController.getElectricityProviders);

// Purchase routes
router.post('/airtime', validateRequest('purchaseAirtime'), vtuController.purchaseAirtime);
router.post('/data', validateRequest('purchaseData'), vtuController.purchaseData);
router.post('/cable', validateRequest('purchaseCable'), vtuController.purchaseCable);
router.post('/electricity', validateRequest('purchaseElectricity'), vtuController.purchaseElectricity);

module.exports = router;
