const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    type: {
        type: String,
        required: [true, 'Project type is required'],
        enum: {
            values: ['ongoing', 'upcoming'],
            message: 'Project type must be either ongoing or upcoming'
        }
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        default: function() {
            return this.type === 'upcoming' 
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default to 1 week from now
                : new Date(); // Default to now
        },
        validate: {
            validator: function(v) {
                // Only validate for upcoming projects that the date is in the future
                if (this.type === 'upcoming' && this.isNew) {
                    return v > new Date();
                }
                return true;
            },
            message: 'Start date must be in the future for upcoming projects'
        }
    },
    techStack: {
        type: [String],
        required: [true, 'Tech stack is required'],
        validate: {
            validator: function(v) {
                return v.length > 0;
            },
            message: 'At least one technology must be specified'
        }
    },
    githubLink: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                if (!v) return true;
                return /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(v);
            },
            message: 'Invalid GitHub repository URL'
        }
    },
    maxParticipants: {
        type: Number,
        required: [true, 'Maximum number of participants is required'],
        min: [1, 'Maximum participants must be at least 1'],
        validate: {
            validator: function(v) {
                return v >= this.participants.length;
            },
            message: 'Maximum participants cannot be less than current number of participants'
        }
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Project admin is required']
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    joinRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        message: {
            type: String,
            trim: true,
            maxlength: [200, 'Message cannot be more than 200 characters']
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        respondedAt: Date
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
projectSchema.index({ title: 'text', description: 'text' });
projectSchema.index({ type: 1, startDate: 1 });
projectSchema.index({ admin: 1 });
projectSchema.index({ participants: 1 });

// Virtual for checking if project is full
projectSchema.virtual('isFull').get(function() {
    return this.participants.length >= this.maxParticipants;
});

// Method to check if a user can join the project
projectSchema.methods.canJoin = function(userId) {
    return !this.isFull && 
           !this.participants.includes(userId) && 
           !this.joinRequests.some(req => 
               req.user.equals(userId) && req.status === 'pending'
           );
};

// Pre-save middleware to ensure admin is always a participant
projectSchema.pre('save', function(next) {
    if (!this.participants.includes(this.admin)) {
        this.participants.push(this.admin);
    }
    next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project; 