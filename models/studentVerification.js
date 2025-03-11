const mongoose = require('mongoose');

const studentVerificationSchema = new mongoose.Schema({
    enrollment_number: {
        type: String,
        required: true,
        unique: true
    },
    contact_number: {
        type: String,
        required: true
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