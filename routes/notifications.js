const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const {
    getUnreadNotifications,
    getAllNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} = require('../utils/notifications');

// Get unread notifications
router.get('/unread', isLoggedIn, async (req, res) => {
    try {
        const notifications = await getUnreadNotifications(req.user._id);
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        res.status(500).json({ message: 'Error fetching unread notifications' });
    }
});

// Get all notifications
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const notifications = await getAllNotifications(req.user._id);
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

// Mark notification as read
router.put('/:notificationId/read', isLoggedIn, async (req, res) => {
    try {
        const notification = await markNotificationAsRead(req.params.notificationId, req.user._id);
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error marking notification as read' });
    }
});

// Mark all notifications as read
router.put('/read-all', isLoggedIn, async (req, res) => {
    try {
        await markAllNotificationsAsRead(req.user._id);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Error marking all notifications as read' });
    }
});

module.exports = router; 