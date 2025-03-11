// Script to test email sending
require('dotenv').config();
const { sendOTPEmail, initializeTransporter } = require('../utils/emailSender');

// Reinitialize the email transporter to pick up the new settings
initializeTransporter();

async function testEmailSending() {
  try {
    console.log('Testing email sending with the following configuration:');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASSWORD:', '******' + process.env.EMAIL_PASSWORD.substring(process.env.EMAIL_PASSWORD.length - 4)); // Show only last 4 chars for security
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // You can change this to any valid test recipient
    const testEmail = 'recipient@example.com'; // Replace with a real recipient email
    const testOTP = '123456';
    const testName = 'Test User';
    
    console.log(`\nAttempting to send test email to: ${testEmail}`);
    
    const result = await sendOTPEmail(testEmail, testOTP, testName);
    
    if (result) {
      console.log('\nEmail sent successfully!');
      console.log('If you don\'t see the email in your inbox, please check:');
      console.log('1. Your spam/junk folder');
      console.log('2. Email provider settings');
    } else {
      console.log('\nFailed to send email. Please check the error logs above.');
    }
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

testEmailSending(); 