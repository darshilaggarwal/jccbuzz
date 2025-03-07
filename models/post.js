const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    images: [{
        url: String,
        aspectRatio: Number
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add pre-delete middleware to clean up associated comments
postSchema.pre(['remove', 'findOneAndDelete', 'deleteOne', 'findOneAndDelete'], async function(next) {
    try {
        // Get the document that's about to be deleted
        const doc = this.getQuery ? await this.model.findOne(this.getQuery()) : this;
        if (!doc) return next();

        // Get the Comment model
        const Comment = mongoose.model('Comment');
        
        // Delete all comments on this post
        await Comment.deleteMany({ post: doc._id });
        
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Post', postSchema); 