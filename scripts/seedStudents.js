// Script to seed student verification data
require('dotenv').config();
const mongoose = require('mongoose');
const students = require('../data/students');
const StudentVerification = require('../models/studentVerification');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/pinspire')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Function to seed student verification data
async function seedStudentVerification() {
    try {
        // Check if there are already students in the database
        const count = await StudentVerification.countDocuments();
        if (count > 0) {
            console.log(`Database already has ${count} student records. Skipping seeding.`);
            return;
        }

        console.log(`Seeding ${students.length} student records...`);
        
        // Process each student and create a record
        for (const student of students) {
            await StudentVerification.create({
                enrollment_number: student.enrollment_number,
                name: student.name,
                email: student.email,
                contact_number: student.contact,
                is_verified: false
            });
        }

        console.log('Student verification data seeded successfully!');
    } catch (error) {
        console.error('Error seeding student data:', error);
    } finally {
        mongoose.disconnect();
    }
}

// Run the seed function
seedStudentVerification(); 