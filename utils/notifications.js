const Notification = require('../models/notification');

/**
 * Create a new notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipient - Recipient user ID
 * @param {string} [params.sender] - Sender user ID (optional for system notifications)
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} [params.data={}] - Additional data like projectId, postId, etc.
 * @returns {Promise<Object>} The created notification
 */
async function createNotification(params) {
    try {
        // Handle both new format and legacy format
        let notification;
        
        // Check if using legacy format (old function signature)
        if (arguments.length > 1) {
            const [recipientId, senderId, type, postId, commentId, storyId] = arguments;
            
            // Map old parameters to new format
            notification = new Notification({
                recipient: recipientId,
                sender: senderId,
                type,
                title: getNotificationTitle(type),
                message: getNotificationMessage(type),
                data: {
                    postId,
                    commentId,
                    storyId
                }
            });
        } else {
            // New format
            notification = new Notification({
                recipient: params.recipient,
                sender: params.sender,
                type: params.type,
                title: params.title || getNotificationTitle(params.type),
                message: params.message || getNotificationMessage(params.type),
                data: params.data || {}
            });
        }

        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

/**
 * Get notification title based on type
 * @param {string} type - Notification type
 * @returns {string} Notification title
 */
function getNotificationTitle(type) {
    switch(type) {
        case 'project_join_request':
            return 'New Join Request';
        case 'project_join_accepted':
            return 'Request Accepted';
        case 'project_join_rejected':
            return 'Request Rejected';
        case 'like':
            return 'New Like';
        case 'comment':
            return 'New Comment';
        case 'follow':
            return 'New Follower';
        case 'reply':
            return 'New Reply';
        case 'comment_like':
            return 'Comment Liked';
        case 'story_view':
            return 'Story Viewed';
        case 'mention':
            return 'Mentioned You';
        case 'new_post':
            return 'New Post';
        case 'followAccepted':
            return 'Follow Request Accepted';
        case 'followRequest':
            return 'New Follow Request';
        default:
            return 'New Notification';
    }
}

/**
 * Get notification message based on type
 * @param {string} type - Notification type
 * @returns {string} Notification message
 */
function getNotificationMessage(type) {
    switch(type) {
        case 'project_join_request':
            return 'Someone wants to join your project';
        case 'project_join_accepted':
            return 'Your request to join a project was accepted';
        case 'project_join_rejected':
            return 'Your request to join a project was rejected';
        case 'like':
            return 'Someone liked your post';
        case 'comment':
            return 'Someone commented on your post';
        case 'follow':
            return 'Someone started following you';
        case 'reply':
            return 'Someone replied to your comment';
        case 'comment_like':
            return 'Someone liked your comment';
        case 'story_view':
            return 'Someone viewed your story';
        case 'mention':
            return 'Someone mentioned you in a comment';
        case 'new_post':
            return 'Someone shared a new post';
        case 'followAccepted':
            return 'Someone accepted your follow request';
        case 'followRequest':
            return 'Someone requested to follow you';
        default:
            return 'You have a new notification';
    }
}

async function getUnreadNotifications(userId) {
    try {
        return await Notification.find({ recipient: userId, read: false })
            .sort({ createdAt: -1 })
            .populate('sender', 'name username profileImage')
            .limit(10);
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        throw error;
    }
}

async function getAllNotifications(userId) {
    try {
        return await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .populate('sender', 'name username profileImage');
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

        notification.read = true;
        notification.readAt = new Date();
        await notification.save();
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
        return { success: true };
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