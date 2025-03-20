const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient is required']
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        required: [true, 'Notification type is required'],
        enum: {
            values: [
                // Project related
                'project_join_request',
                'project_join_accepted',
                'project_join_rejected',
                'project_created',
                'project_updated',
                'project_deleted',
                
                // Content related
                'like',
                'comment',
                'comment_like',
                'post_share',
                'new_post',
                
                // Social related
                'follow',
                'followRequest',
                'followAccepted',
                'mention',
                'reply',
                'story_view'
            ],
            message: 'Invalid notification type'
        }
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [200, 'Message cannot be more than 200 characters']
    },
    data: {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project'
        },
        requestId: {
            type: mongoose.Schema.Types.ObjectId
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        },
        commentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment'
        },
        storyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Story'
        }
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ sender: 1 });

// Virtual for project reference
notificationSchema.virtual('project', {
    ref: 'Project',
    localField: 'data.projectId',
    foreignField: '_id',
    justOne: true
});

// Virtual for post reference
notificationSchema.virtual('post', {
    ref: 'Post',
    localField: 'data.postId',
    foreignField: '_id',
    justOne: true
});

// Virtual for comment reference
notificationSchema.virtual('comment', {
    ref: 'Comment',
    localField: 'data.commentId',
    foreignField: '_id',
    justOne: true
});

// Virtual for story reference
notificationSchema.virtual('story', {
    ref: 'Story',
    localField: 'data.storyId',
    foreignField: '_id',
    justOne: true
});

// Create a display text field for UI
notificationSchema.virtual('displayMessage').get(function() {
    if (this.message) return this.message;
    
    // Fallback logic for backward compatibility
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

// Add method to mark notification as read
notificationSchema.methods.markAsRead = async function() {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 