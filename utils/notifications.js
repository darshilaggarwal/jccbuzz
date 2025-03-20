const Notification = require('../models/notification');

const createNotification = async ({ recipient, sender, type, text, project = null, post = null, comment = null, story = null }) => {
    try {
        const notification = new Notification({
            recipient,
            sender,
            type,
            text,
            project,
            post,
            comment,
            story
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

module.exports = {
    createNotification
}; 