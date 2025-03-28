# Student Verification Database Scripts

This directory contains scripts for managing and testing the student verification database used by JCC Buzz.

## Available Scripts

### Add New Students
Run `node scripts/addNewStudents.js` to add or update student records in the database.
- This script adds a batch of 25 predefined student records.
- If a student already exists, it will be skipped.
- Each record includes enrollment number, name, email, and contact number.

### Test Student OTP
Run `node scripts/testStudentOTP.js` to test the OTP generation and sending for a specific student.
- This script generates and simulates sending an OTP to the specified student.
- In development mode, the OTP will be logged to the console.

### Test OTP Request Endpoint
Run `node scripts/testOTPRequest.js` to test the OTP request API endpoint.
- This script directly tests the `/verify/request-otp` endpoint with a test enrollment number.
- It provides detailed feedback on the response and helpful diagnostics if issues occur.
- Useful for troubleshooting registration issues related to OTP requests.

### Test Complete Registration Flow
Run `node scripts/testRegistrationFlow.js` to test the entire student verification flow.
- This interactive script tests both OTP request and verification steps.
- It also checks if a user with the test enrollment number already exists.
- Provides detailed diagnostics for troubleshooting registration issues.

### Check Student Data
Run `node scripts/checkStudents.js` to check if a specific student exists in the database.
- Provide an enrollment number as a command-line argument to check that specific student.
- Without arguments, it will list all student records.

### Verify New Students 
Run `node scripts/verifyNewStudent.js` to check if newly added students exist in the database.
- This script verifies the presence of test enrollment numbers from the new student batch.
- It also checks database connection and overall database status.
- Helpful for diagnosing issues with student verification.

### Seed Student Data
Run `node scripts/seedStudents.js` to populate the database with initial student records.
- This only seeds the database if it's empty.
- Useful for initial setup.

## OTP Functionality

The student verification system supports sending OTPs via:
1. Email (primary method)
2. SMS (fallback if email fails)

In development mode, OTPs are logged to the console for testing purposes. In production, this logging is disabled.

## Student Data Structure

Each student record contains:
- `enrollment_number`: Unique identifier for the student
- `name`: Student's full name
- `email`: Student's email address
- `contact_number`: Student's mobile number
- `is_verified`: Boolean flag indicating if the student has been verified
- `otp`: Object containing the current OTP and its expiration time

## Troubleshooting Registration Issues

If users are experiencing "Invalid enrollment number" errors during registration:

1. **Verify student data exists**: Run `node scripts/verifyNewStudent.js` to check if the student records exist in the database.
2. **Test OTP request directly**: Run `node scripts/testOTPRequest.js` to test the API endpoint directly.
3. **Check complete flow**: Run `node scripts/testRegistrationFlow.js` to test the entire verification process.
4. **Server restart**: If all tests pass but the UI still shows errors, try restarting the server to ensure it's using the latest database records.
5. **Check browser console**: Look for network request errors in the browser developer tools.

## Important Notes

- OTPs expire after 2 minutes
- In production, OTPs are only sent to registered email addresses and are not logged
- These scripts are primarily for development and administrative purposes 