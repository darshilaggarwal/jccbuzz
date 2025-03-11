const mongoose = require('mongoose');

const studentVerificationSchema = new mongoose.Schema({
    enrollment_number: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    contact_number: {
        type: String,
        required: false // Making this optional since we're using email now
    },
    is_verified: {
        type: Boolean,
        default: false
    },
    otp: {
        code: String,
        expires_at: Date
    }
});

module.exports = mongoose.model('StudentVerification', studentVerificationSchema); 