const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient is required']
    },
    type: {
        type: String,
        required: [true, 'Notification type is required'],
        enum: {
            values: [
                'project_join_request',
                'project_join_accepted',
                'project_join_rejected',
                'project_created',
                'project_updated',
                'project_deleted'
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
        }
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date
}, {
    timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

// Method to mark notification as read
notificationSchema.methods.markAsRead = async function() {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        await this.save();
    }
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 