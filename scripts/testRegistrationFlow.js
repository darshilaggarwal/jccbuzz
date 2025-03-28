// Script to test the complete registration flow
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const readline = require('readline');

// Configure readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Test enrollment number to use
const testEnrollmentNumber = '021322001'; // Abhijith Prabhakar

// Determine the base URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const connectionString = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/jccbuzz';
        console.log(`Connecting to MongoDB at: ${connectionString}`);
        
        await mongoose.connect(connectionString);
        console.log('Connected to MongoDB successfully');
        
        return true;
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error.message);
        return false;
    }
}

// Function to test OTP request
async function requestOTP() {
    try {
        console.log(`\n1️⃣ STEP 1: Requesting OTP for enrollment number: ${testEnrollmentNumber}`);
        console.log(`Using API endpoint: ${BASE_URL}/verify/request-otp`);
        
        // Make API request
        const response = await axios.post(`${BASE_URL}/verify/request-otp`, {
            enrollment_number: testEnrollmentNumber
        });
        
        console.log('\n=== API RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n✅ SUCCESS: OTP request was successful!');
            
            if (response.data.student_email) {
                console.log(`An OTP was sent to ${response.data.student_email}`);
            }
            
            if (response.data.dev_otp) {
                console.log(`\nDevelopment OTP: ${response.data.dev_otp}`);
                console.log('Expires at:', response.data.expires_at);
                return {
                    success: true,
                    otp: response.data.dev_otp,
                    expires_at: response.data.expires_at
                };
            } else {
                // In production environment, we need to get OTP from user
                return { success: true, needUserOTP: true };
            }
        } else {
            console.log('\n❌ ERROR: OTP request failed.');
            console.log('Error message:', response.data.error);
            return { success: false, error: response.data.error };
        }
    } catch (error) {
        console.error('\n❌ ERROR: Failed to make API request');
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            return { 
                success: false, 
                error: error.response.data.error || 'API request failed' 
            };
        } else {
            console.error('Error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Function to verify OTP
async function verifyOTP(otp) {
    try {
        console.log(`\n2️⃣ STEP 2: Verifying OTP: ${otp} for enrollment number: ${testEnrollmentNumber}`);
        
        // Make API request
        const response = await axios.post(`${BASE_URL}/verify/verify-otp`, {
            enrollment_number: testEnrollmentNumber,
            otp: otp
        });
        
        console.log('\n=== API RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n✅ SUCCESS: OTP verified successfully!');
            
            if (response.data.student) {
                console.log('\nStudent details:');
                console.log('Name:', response.data.student.name);
                console.log('Email:', response.data.student.email);
            }
            
            return { 
                success: true, 
                student: response.data.student 
            };
        } else {
            console.log('\n❌ ERROR: OTP verification failed.');
            console.log('Error message:', response.data.error);
            return { success: false, error: response.data.error };
        }
    } catch (error) {
        console.error('\n❌ ERROR: Failed to verify OTP');
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            return { 
                success: false, 
                error: error.response.data.error || 'OTP verification failed' 
            };
        } else {
            console.error('Error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Function to check existing users with this enrollment number
async function checkExistingUser() {
    try {
        // Get mongoose models
        const connection = mongoose.connection;
        const User = connection.model('User') || 
            mongoose.model('User', new mongoose.Schema({
                enrollment_number: String,
                username: String,
                email: String
            }));
        
        // Check if user exists
        const existingUser = await User.findOne({ enrollment_number: testEnrollmentNumber });
        
        if (existingUser) {
            console.log('\n⚠️ NOTE: A user with this enrollment number already exists in the database');
            console.log('Username:', existingUser.username);
            console.log('Email:', existingUser.email);
            return true;
        } else {
            console.log('\n✅ No existing user found with this enrollment number');
            return false;
        }
    } catch (error) {
        console.error('\n❓ Could not check for existing user:', error.message);
        return false;
    }
}

// Function to prompt user for input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Main function to run the test
async function runTest() {
    try {
        console.log('🔍 TESTING COMPLETE REGISTRATION FLOW');
        console.log('====================================');
        
        // Connect to MongoDB
        const isConnected = await connectToMongoDB();
        if (!isConnected) {
            console.error('Cannot proceed without MongoDB connection');
            rl.close();
            return;
        }
        
        // Check if user already exists
        const existingUser = await checkExistingUser();
        if (existingUser) {
            const continueTest = await prompt('\nDo you want to continue testing anyway? (y/n): ');
            if (continueTest.toLowerCase() !== 'y') {
                console.log('Test aborted. You may want to use a different enrollment number.');
                rl.close();
                return;
            }
        }
        
        // Step 1: Request OTP
        const otpRequest = await requestOTP();
        if (!otpRequest.success) {
            console.error('\n❌ Test failed at OTP request step:', otpRequest.error);
            rl.close();
            return;
        }
        
        // Get OTP (either from response in dev mode or from user input)
        let otp;
        if (otpRequest.otp) {
            otp = otpRequest.otp;
            console.log(`\nUsing development OTP: ${otp}`);
        } else {
            otp = await prompt('\nPlease enter the OTP you received: ');
        }
        
        // Step 2: Verify OTP
        const otpVerification = await verifyOTP(otp);
        if (!otpVerification.success) {
            console.error('\n❌ Test failed at OTP verification step:', otpVerification.error);
            rl.close();
            return;
        }
        
        console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
        console.log('The student was successfully verified and can now register.');
        console.log('\nNext steps in the actual registration flow would be:');
        console.log('1. Fill out and submit the registration form with username, password, etc.');
        console.log('2. Complete the registration process');
        
        console.log('\nSINCE THIS IS A TEST: If you were seeing "Invalid enrollment number" errors in the UI');
        console.log('but this test passed, the issue might be in the frontend code or network requests.');
        console.log('Consider checking:');
        console.log('1. The format of enrollment number being sent from the frontend');
        console.log('2. Network requests in browser dev tools');
        console.log('3. Any client-side validation that might be rejecting the enrollment number');
        
    } catch (error) {
        console.error('Unexpected error during test:', error);
    } finally {
        rl.close();
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('\nMongoDB connection closed');
    }
}

// Run the test
runTest(); 