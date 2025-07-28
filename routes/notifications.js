const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { notificationService } = require('../services/notificationService');
const { generateResponse } = require('../utils/helpers');

// All notification routes require authentication
router.use(authMiddleware);

// Get user notifications
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, unread_only = false, type } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            unreadOnly: unread_only === 'true',
            type: type || null
        };

        const result = await notificationService.getUserNotifications(userId, options);

        if (!result.success) {
            return res.status(500).json(generateResponse(false, 'Failed to retrieve notifications'));
        }

        res.json(generateResponse(true, 'Notifications retrieved successfully', {
            notifications: result.notifications,
            pagination: result.pagination
        }));

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json(generateResponse(false, 'Internal server error'));
    }
});

// Get unread notification count
router.get('/count', async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await notificationService.getUnreadCount(userId);

        if (!result.success) {
            return res.status(500).json(generateResponse(false, 'Failed to get notification count'));
        }

        res.json(generateResponse(true, 'Notification count retrieved successfully', {
            unread_count: result.count
        }));

    } catch (error) {
        console.error('Get notification count error:', error);
        res.status(500).json(generateResponse(false, 'Internal server error'));
    }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        if (!notificationId) {
            return res.status(400).json(generateResponse(false, 'Notification ID is required'));
        }

        const result = await notificationService.markAsRead(notificationId, userId);

        if (!result.success) {
            return res.status(500).json(generateResponse(false, 'Failed to mark notification as read'));
        }

        res.json(generateResponse(true, 'Notification marked as read', {
            notification: result.notification
        }));

    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json(generateResponse(false, 'Internal server error'));
    }
});

// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await notificationService.markAllAsRead(userId);

        if (!result.success) {
            return res.status(500).json(generateResponse(false, 'Failed to mark all notifications as read'));
        }

        res.json(generateResponse(true, 'All notifications marked as read', {
            updated_count: result.updated_count
        }));

    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json(generateResponse(false, 'Internal server error'));
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;

        if (!notificationId) {
            return res.status(400).json(generateResponse(false, 'Notification ID is required'));
        }

        const result = await notificationService.deleteNotification(notificationId, userId);

        if (!result.success) {
            return res.status(500).json(generateResponse(false, 'Failed to delete notification'));
        }

        res.json(generateResponse(true, 'Notification deleted successfully'));

    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json(generateResponse(false, 'Internal server error'));
    }
});

module.exports = router;
