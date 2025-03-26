const Notification = require('../models/notification');
const { sendRealTimeNotification } = require('../socket/socket');

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
        
        // Send real-time notification via socket
        try {
            // Populate sender if needed for real-time display
            if (notification.sender) {
                await notification.populate('sender', 'name username profileImage');
            }
            
            // Emit the notification to the recipient via socket
            if (global.io) {
                global.io.to(`user:${notification.recipient.toString()}`).emit('new_notification', notification);
            }
        } catch (socketError) {
            console.error('Socket notification error:', socketError);
            // Continue even if socket notification fails
        }
        
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
        // Project notifications
        case 'project_join_request':
            return 'New Join Request';
        case 'project_join_accepted':
            return 'Request Accepted';
        case 'project_join_rejected':
            return 'Request Rejected';
            
        // Social notifications
        case 'like':
            return 'New Like';
        case 'comment':
            return 'New Comment';
        case 'follow':
            return 'New Follower';
        case 'follow_request':
            return 'New Follow Request';
        case 'follow_accepted':
            return 'Follow Request Accepted';
        case 'reply':
            return 'New Reply';
        case 'comment_like':
            return 'Comment Liked';
        case 'mention':
            return 'Mentioned You';
        case 'new_post':
            return 'New Post';
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
        // Project notifications
        case 'project_join_request':
            return 'Someone wants to join your project';
        case 'project_join_accepted':
            return 'Your request to join a project was accepted';
        case 'project_join_rejected':
            return 'Your request to join a project was rejected';
            
        // Social notifications
        case 'like':
            return 'Someone liked your post';
        case 'comment':
            return 'Someone commented on your post';
        case 'follow':
            return 'Someone started following you';
        case 'follow_request':
            return 'Someone requested to follow you';
        case 'follow_accepted':
            return 'Someone accepted your follow request';
        case 'reply':
            return 'Someone replied to your comment';
        case 'comment_like':
            return 'Someone liked your comment';
        case 'mention':
            return 'Someone mentioned you in a comment';
        case 'new_post':
            return 'Someone shared a new post';
        default:
            return 'You have a new notification';
    }
}

/**
 * Create a like notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - Post owner's user ID
 * @param {string} params.senderId - ID of user who liked the post
 * @param {string} params.senderName - Name of user who liked the post
 * @param {string} params.postId - ID of the liked post
 */
async function createLikeNotification({ recipientId, senderId, senderName, postId }) {
    // Don't notify if user likes their own post
    if (recipientId.toString() === senderId.toString()) {
        return null;
    }
    
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'like',
        title: 'New Like',
        message: `${senderName} liked your post`,
        data: { postId }
    });
}

/**
 * Create a comment notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - Post owner's user ID
 * @param {string} params.senderId - ID of user who commented
 * @param {string} params.senderName - Name of user who commented
 * @param {string} params.postId - ID of the post
 * @param {string} params.commentId - ID of the comment
 */
async function createCommentNotification({ recipientId, senderId, senderName, postId, commentId }) {
    // Don't notify if user comments on their own post
    if (recipientId.toString() === senderId.toString()) {
        return null;
    }
    
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'comment',
        title: 'New Comment',
        message: `${senderName} commented on your post`,
        data: { postId, commentId }
    });
}

/**
 * Create a reply notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - Comment owner's user ID
 * @param {string} params.senderId - ID of user who replied
 * @param {string} params.senderName - Name of user who replied
 * @param {string} params.postId - ID of the post
 * @param {string} params.commentId - ID of the parent comment
 */
async function createReplyNotification({ recipientId, senderId, senderName, postId, commentId }) {
    // Don't notify if user replies to their own comment
    if (recipientId.toString() === senderId.toString()) {
        return null;
    }
    
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'reply',
        title: 'New Reply',
        message: `${senderName} replied to your comment`,
        data: { postId, commentId }
    });
}

/**
 * Create a mention notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - Mentioned user's ID
 * @param {string} params.senderId - ID of user who mentioned
 * @param {string} params.senderName - Name of user who mentioned
 * @param {string} params.postId - ID of the post
 * @param {string} params.commentId - ID of the comment (optional)
 */
async function createMentionNotification({ recipientId, senderId, senderName, postId, commentId }) {
    // Don't notify if user mentions themselves
    if (recipientId.toString() === senderId.toString()) {
        return null;
    }
    
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'mention',
        title: 'You Were Mentioned',
        message: `${senderName} mentioned you in a ${commentId ? 'comment' : 'post'}`,
        data: { postId, commentId }
    });
}

/**
 * Create a follow notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - Followed user's ID
 * @param {string} params.senderId - ID of user who followed
 * @param {string} params.senderName - Name of user who followed
 */
async function createFollowNotification({ recipientId, senderId, senderName }) {
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'follow',
        title: 'New Follower',
        message: `${senderName} started following you`,
        data: {}
    });
}

/**
 * Create a follow request notification
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - User who received the follow request
 * @param {string} params.senderId - ID of user who sent the request
 * @param {string} params.senderName - Name of user who sent the request
 */
async function createFollowRequestNotification({ recipientId, senderId, senderName }) {
    return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'follow_request',
        title: 'New Follow Request',
        message: `${senderName} wants to follow you`,
        data: {}
    });
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
    createLikeNotification,
    createCommentNotification,
    createReplyNotification,
    createMentionNotification,
    createFollowNotification,
    createFollowRequestNotification,
    getUnreadNotifications,
    getAllNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
}; 