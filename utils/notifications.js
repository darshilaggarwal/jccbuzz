const Notification = require('../models/notification');

async function createNotification({ recipient, type, title, message, data = {} }) {
    try {
        const notification = new Notification({
            recipient,
            type,
            title,
            message,
            data
        });

        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

async function getUnreadNotifications(userId) {
    try {
        return await Notification.find({ recipient: userId, read: false })
            .sort({ createdAt: -1 })
            .limit(10);
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        throw error;
    }
}

async function getAllNotifications(userId) {
    try {
        return await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 });
    } catch (error) {
        console.error('Error fetching all notifications:', error);
        throw error;
    }
}

async function markNotificationAsRead(notificationId, userId) {
    try {
        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: userId
        });

        if (!notification) {
            throw new Error('Notification not found');
        }

        await notification.markAsRead();
        return notification;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

async function markAllNotificationsAsRead(userId) {
    try {
        await Notification.updateMany(
            { recipient: userId, read: false },
            { 
                $set: { 
                    read: true,
                    readAt: new Date()
                }
            }
        );
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

module.exports = {
    createNotification,
    getUnreadNotifications,
    getAllNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
}; 