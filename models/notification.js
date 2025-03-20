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
        required: true,
        enum: ['project_join_request', 'project_join_accepted', 'project_join_rejected', 'like', 'comment', 'follow', 'reply', 'comment_like', 'story_view', 'mention', 'new_post', 'followAccepted', 'followRequest']
    },
    text: {
        type: String,
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
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
    }
}, {
    timestamps: true
});

// Create a display text field for UI (renamed from text to displayMessage)
notificationSchema.virtual('displayMessage').get(function() {
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
        case 'new_post':
            return 'shared a new post';
        case 'followRequest':
            return 'requested to follow you';
        case 'followAccepted':
            return 'accepted your follow request';
        case 'project_join_request':
            return 'requested to join your project';
        case 'project_join_accepted':
            return 'accepted your project join request';
        case 'project_join_rejected':
            return 'rejected your project join request';
        default:
            return 'interacted with your content';
    }
});

notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema); 