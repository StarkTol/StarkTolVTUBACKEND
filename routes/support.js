const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');

// Support routes - all require authentication
router.use(authMiddleware);

// Ticket management
router.post('/tickets', validateRequest('createTicket'), supportController.createTicket);
router.get('/tickets', supportController.getTickets);
router.get('/tickets/stats', supportController.getTicketStats);
router.get('/tickets/:id', supportController.getTicket);
router.post('/tickets/:id/reply', validateRequest('replyToTicket'), supportController.replyToTicket);
router.put('/tickets/:id/close', supportController.closeTicket);
router.put('/tickets/:id/rate', validateRequest('rateTicket'), supportController.rateTicket);

// FAQ
router.get('/faq', supportController.getFAQ);
router.get('/faq/search', supportController.searchFAQ);

module.exports = router;
