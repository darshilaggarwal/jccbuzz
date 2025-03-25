const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { 
        type: String, 
        required: true,
        enum: ['competition', 'workshop', 'gathering', 'cultural', 'academic', 'other']
    },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    location: { type: String, required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizerName: { type: String },
    image: { type: String, default: '/images/default-event.jpg' },
    registrationLink: { type: String },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    saved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema); 