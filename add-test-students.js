// Script to add test student data to the database
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import the StudentVerification model
const StudentVerification = require('./models/StudentVerification');

// Connect to MongoDB - USING ORIGINAL PINSPIRE DATABASE
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinspire')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Test student data
const testStudents = [
    {
        enrollment_number: '021323008',
        name: 'Darshil Aggarwal',
        email: 'darshilaggarwal55@gmail.com',
        contact_number: '9876543210',
        is_verified: false
    },
    {
        enrollment_number: '021323003',
        name: 'Test Student',
        email: 'test.student@example.com',
        contact_number: '9876543211',
        is_verified: false
    }
];

// Function to add test students
async function addTestStudents() {
    try {
        console.log('Adding test students to database...');
        
        for (const student of testStudents) {
            // Check if student already exists
            const existingStudent = await StudentVerification.findOne({ enrollment_number: student.enrollment_number });
            
            if (existingStudent) {
                console.log(`Student with enrollment number ${student.enrollment_number} already exists.`);
            } else {
                // Create new student
                await StudentVerification.create(student);
                console.log(`Added student: ${student.name} (${student.enrollment_number})`);
            }
        }
        
        console.log('Test students added successfully!');
    } catch (error) {
        console.error('Error adding test students:', error);
    } finally {
        // Close MongoDB connection
        mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run the function
addTestStudents(); 