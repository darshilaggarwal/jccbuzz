const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Project title is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Project type is required'],
        enum: ['ongoing', 'upcoming'],
        default: 'ongoing'
    },
    startDate: {
        type: Date,
        required: function() {
            return this.type === 'upcoming';
        }
    },
    description: {
        type: String,
        required: [true, 'Project description is required'],
        trim: true
    },
    techStack: {
        type: [String],
        required: [true, 'At least one technology is required'],
        validate: {
            validator: function(v) {
                return v && v.length > 0 && v.every(tech => tech.trim().length > 0);
            },
            message: 'At least one technology is required'
        }
    },
    githubLink: {
        type: String,
        trim: true,
        default: ''
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    maxParticipants: {
        type: Number,
        required: [true, 'Maximum participants is required'],
        min: [1, 'Maximum participants must be at least 1']
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    joinRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
projectSchema.index({ type: 1, createdAt: -1 });
projectSchema.index({ admin: 1 });
projectSchema.index({ participants: 1 });

// Virtual for checking if project is full
projectSchema.virtual('isFull').get(function() {
    return this.participants.length >= this.maxParticipants;
});

// Method to check if a user can join
projectSchema.methods.canJoin = function(userId) {
    return !this.isFull && 
           !this.participants.includes(userId) && 
           !this.joinRequests.some(req => 
               req.user.equals(userId) && req.status === 'pending'
           );
};

// Method to add a participant
projectSchema.methods.addParticipant = function(userId) {
    if (!this.isFull && !this.participants.includes(userId)) {
        this.participants.push(userId);
        return true;
    }
    return false;
};

// Method to remove a participant
projectSchema.methods.removeParticipant = function(userId) {
    const index = this.participants.indexOf(userId);
    if (index > -1) {
        this.participants.splice(index, 1);
        return true;
    }
    return false;
};

// Method to handle join request
projectSchema.methods.handleJoinRequest = function(userId, status) {
    const request = this.joinRequests.find(req => 
        req.user.equals(userId) && req.status === 'pending'
    );
    
    if (request) {
        request.status = status;
        if (status === 'accepted') {
            return this.addParticipant(userId);
        }
        return true;
    }
    return false;
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project; 