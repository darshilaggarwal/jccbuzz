// Script to test OTP functionality with a new student
require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('../models/studentVerification');
const { sendOTPEmail } = require('../utils/emailSender');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/pinspire')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Function to generate a 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to a student (testing function)
async function testStudentOTP(enrollmentNumber) {
    try {
        console.log(`Testing OTP for enrollment number: ${enrollmentNumber}`);
        
        // Find the student record
        const student = await StudentVerification.findOne({ enrollment_number: enrollmentNumber });
        
        if (!student) {
            console.error(`Student with enrollment number ${enrollmentNumber} not found.`);
            return;
        }
        
        console.log(`Found student: ${student.name} (${student.email})`);
        
        // Generate a test OTP
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 2); // OTP expires in 2 minutes
        
        console.log(`Generated OTP: ${otp}`);
        console.log(`This OTP will expire at: ${expiresAt}`);
        
        // Send OTP to student's email
        if (student.email) {
            console.log(`Sending OTP to email: ${student.email}`);
            const sent = await sendOTPEmail(student.email, otp, student.name);
            if (sent) {
                console.log('Email sent successfully!');
            } else {
                console.error('Failed to send email.');
            }
        } else {
            console.error('Student has no email address.');
        }
        
        // Save the OTP to the student record for verification
        student.otp = {
            code: otp,
            expires_at: expiresAt
        };
        await student.save();
        
        console.log('OTP saved to student record.');
        console.log('-------------------------------------------');
        console.log('You can now test verification with this OTP');
        console.log('-------------------------------------------');
        
    } catch (error) {
        console.error('Error testing student OTP:', error);
    } finally {
        mongoose.disconnect();
    }
}

// Test with one of the new enrollment numbers
// You can change this to any enrollment number you want to test
const testEnrollmentNumber = "021322001"; // Abhijith Prabhakar

// Run the test
testStudentOTP(testEnrollmentNumber); 