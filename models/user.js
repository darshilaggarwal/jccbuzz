const mongoose = require('mongoose');

mongoose.connect("mongodb://127.0.0.1:27017/pinspire")

const userSchema = new mongoose.Schema({
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
    bio: {
        type: String,
        default: "Hey there! I'm using Pinspire"
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String,
        default: '/images/default-profile.png' // Update this path
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    hasActiveStory: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', userSchema); 