// Script to test the OTP request endpoint directly
require('dotenv').config();
const axios = require('axios');

// Test enrollment number to use
const testEnrollmentNumber = '021322001'; // Abhijith Prabhakar

// Determine the base URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Function to test the OTP request
async function testOTPRequest() {
    try {
        console.log(`Testing OTP request for enrollment number: ${testEnrollmentNumber}`);
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
            console.log(`An OTP was sent to ${response.data.student_email || 'the student email'}`);
            
            if (response.data.dev_otp) {
                console.log(`\nDevelopment OTP: ${response.data.dev_otp}`);
                console.log('Expires at:', response.data.expires_at);
            }
        } else {
            console.log('\n❌ ERROR: OTP request failed.');
            console.log('Error message:', response.data.error);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR: Failed to make API request');
        
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            if (error.response.data && error.response.data.error) {
                console.error('\nServer error message:', error.response.data.error);
                
                if (error.response.data.error.includes('Invalid enrollment number')) {
                    console.log('\n🔍 DIAGNOSIS: The enrollment number is being rejected by the API.');
                    console.log('Possible reasons:');
                    console.log('1. The API might be using a different database connection than the scripts');
                    console.log('2. There might be case-sensitivity issues with the enrollment number');
                    console.log('3. The server might need to be restarted to recognize the new students');
                    console.log('\nSuggested solutions:');
                    console.log('1. Restart the server application');
                    console.log('2. Check the database connection in the API endpoint');
                    console.log('3. Verify the exact format of enrollment numbers being used');
                }
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server. Server might be down.');
            console.error('Check that your server is running at:', BASE_URL);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
        }
    }
}

// Run the test
testOTPRequest(); 