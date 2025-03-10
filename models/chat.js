const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: false // Not required for media messages or shared posts
    },
    mediaType: {
        type: String,
        enum: ['none', 'image', 'video'],
        default: 'none'
    },
    mediaUrl: {
        type: String,
        default: null
    },
    isStoryReply: {
        type: Boolean,
        default: false
    },
    storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Story'
    },
    isPostShare: {
        type: Boolean,
        default: false
    },
    sharedPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        default: null
    },
    sharedPostPreview: {
        title: String,
        content: String,
        image: String,
        postId: mongoose.Schema.Types.ObjectId
    },
    reaction: {
        type: String,
        default: null
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages: [messageSchema],
    lastActivity: {
        type: Date,
        default: Date.now
    }
});

// Update lastActivity when a new message is added
chatSchema.pre('save', function(next) {
    if (this.isModified('messages')) {
        this.lastActivity = Date.now();
    }
    next();
});

module.exports = mongoose.model('Chat', chatSchema); 