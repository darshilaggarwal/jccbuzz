const mongoose = require('mongoose');

// Ensure MongoDB connection is established
if (mongoose.connection.readyState !== 1) {
    mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pinspire")
        .then(() => console.log("MongoDB connected successfully"))
        .catch(err => console.error("MongoDB connection error:", err));
}

// Check if the model already exists before defining
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    enrollment_number: {
        type: String,
        required: true,
        unique: true
    },
    bio: {
        type: String,
        default: "Hey there! I'm using JCCbuzz"
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String,
        default: '/placeholder/placeholder.webp' // Updated to use placeholder.webp
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    savedPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isPrivate: {
        type: Boolean,
        default: false
    },
    followRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    hasActiveStory: {
        type: Boolean,
        default: false
    },
    darkMode: {
        type: Boolean,
        default: false
    }
}));

// Update middleware to work with findOneAndDelete and findByIdAndDelete
User.schema.pre(['remove', 'findOneAndDelete', 'deleteOne', 'findOneAndDelete'], async function(next) {
    try {
        // Get the document that's about to be deleted
        const doc = this.getQuery ? await this.model.findOne(this.getQuery()) : this;
        if (!doc) return next();

        // Get the Post model
        const Post = mongoose.model('Post');
        const Comment = mongoose.model('Comment');
        
        // Delete all posts by this user
        const posts = await Post.find({ user: doc._id });
        
        // Delete all comments on these posts
        for (const post of posts) {
            await Comment.deleteMany({ post: post._id });
        }
        
        // Delete the posts
        await Post.deleteMany({ user: doc._id });
        
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = User; 