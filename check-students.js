// Script to check student records in the pinspire database
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import the StudentVerification model
const StudentVerification = require('./models/StudentVerification');

// Connect to MongoDB - USING ORIGINAL PINSPIRE DATABASE
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinspire')
    .then(() => console.log('Connected to MongoDB - pinspire database'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Function to check student records
async function checkStudentRecords() {
    try {
        console.log('Checking student records in pinspire database...');
        
        const students = await StudentVerification.find({
            enrollment_number: { $in: ['021323008', '021323003'] }
        });
        
        console.log('Found', students.length, 'student records:');
        
        students.forEach(student => {
            console.log(`\nEnrollment Number: ${student.enrollment_number}`);
            console.log(`Name: ${student.name}`);
            console.log(`Email: ${student.email}`);
            console.log(`Contact Number: ${student.contact_number}`);
            console.log(`Verified: ${student.is_verified}`);
        });
        
    } catch (error) {
        console.error('Error checking student records:', error);
    } finally {
        // Close MongoDB connection
        mongoose.connection.close();
        console.log('\nMongoDB connection closed');
    }
}

// Run the function
checkStudentRecords(); 