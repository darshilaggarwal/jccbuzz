// Script to update student email in the pinspire database
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

// Function to update student email
async function updateStudentEmail() {
    try {
        console.log('Updating student email in pinspire database...');
        
        // Find the current record
        const student = await StudentVerification.findOne({ enrollment_number: '021323008' });
        console.log('Current email for enrollment 021323008:', student.email);
        
        // Update the email
        const result = await StudentVerification.updateOne(
            { enrollment_number: '021323008' },
            { $set: { email: 'darshilaggarwal55@gmail.com' } }
        );
        
        console.log('Update result:', result);
        
        // Verify the update
        const updatedStudent = await StudentVerification.findOne({ enrollment_number: '021323008' });
        console.log('Updated email for enrollment 021323008:', updatedStudent.email);
        
    } catch (error) {
        console.error('Error updating student email:', error);
    } finally {
        // Close MongoDB connection
        mongoose.connection.close();
        console.log('\nMongoDB connection closed');
    }
}

// Run the function
updateStudentEmail(); 