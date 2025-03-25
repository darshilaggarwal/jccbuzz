const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    avatar: {
        type: String
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'file', 'image'],
            default: 'text'
        },
        replyTo: {
            messageId: mongoose.Schema.Types.ObjectId,
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            content: String
        },
        reactions: {
            type: Map,
            of: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }]
        },
        readBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        deliveredTo: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    lastMessage: {
        content: String,
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        type: {
            type: String,
            enum: ['text', 'file', 'image'],
            default: 'text'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: new Map()
    },
    settings: {
        notifications: {
            type: Boolean,
            default: true
        },
        muteUntil: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for better query performance
groupSchema.index({ admin: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ 'messages.timestamp': 1 });
groupSchema.index({ 'lastMessage.timestamp': 1 });

// Virtual for getting unread count for a specific user
groupSchema.virtual('unreadCountForUser').get(function(userId) {
    return this.unreadCounts.get(userId.toString()) || 0;
});

// Method to mark messages as read for a user
groupSchema.methods.markAsRead = async function(userId) {
    const unreadMessages = this.messages.filter(msg => 
        !msg.readBy.includes(userId) && 
        msg.sender.toString() !== userId.toString()
    );

    for (const msg of unreadMessages) {
        msg.readBy.push(userId);
    }

    this.unreadCounts.set(userId.toString(), 0);
    await this.save();
};

// Method to increment unread count for all members except sender
groupSchema.methods.incrementUnreadCounts = async function(senderId) {
    for (const memberId of this.members) {
        if (memberId.toString() !== senderId.toString()) {
            const currentCount = this.unreadCounts.get(memberId.toString()) || 0;
            this.unreadCounts.set(memberId.toString(), currentCount + 1);
        }
    }
    await this.save();
};

const Group = mongoose.model('Group', groupSchema);

module.exports = Group; 