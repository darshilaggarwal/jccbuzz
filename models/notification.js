const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'reply', 'comment_like', 'story_view', 'mention'],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    comment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    story: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Story'
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Notifications expire after 30 days
    }
});

// Create a text field for display in UI
notificationSchema.virtual('text').get(function() {
    switch(this.type) {
        case 'like':
            return 'liked your post';
        case 'comment':
            return 'commented on your post';
        case 'follow':
            return 'started following you';
        case 'reply':
            return 'replied to your comment';
        case 'comment_like':
            return 'liked your comment';
        case 'story_view':
            return 'viewed your story';
        case 'mention':
            return 'mentioned you in a comment';
        default:
            return 'interacted with your content';
    }
});

notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema); 