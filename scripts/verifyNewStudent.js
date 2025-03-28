// Script to verify if new students exist in the database
require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('../models/studentVerification');

// Function to verify if a student exists
async function verifyStudent(enrollmentNumber) {
    try {
        console.log(`Checking if student with enrollment number ${enrollmentNumber} exists...`);
        
        // Find the student record
        const student = await StudentVerification.findOne({ enrollment_number: enrollmentNumber });
        
        if (!student) {
            console.error(`❌ STUDENT NOT FOUND: Enrollment number ${enrollmentNumber} does not exist in the database.`);
            return false;
        }
        
        console.log(`✅ STUDENT FOUND: ${student.name} (${student.email})`);
        console.log('Student details:');
        console.log(JSON.stringify(student, null, 2));
        return true;
        
    } catch (error) {
        console.error('Error verifying student:', error);
        return false;
    }
}

// Function to check database connection and collection
async function checkDatabaseStatus() {
    try {
        // Check database connection
        console.log('Checking database connection...');
        
        // Check StudentVerification model
        console.log('Checking StudentVerification collection...');
        
        // Get the collection name from the model
        const studentCollection = StudentVerification.collection.name;
        console.log(`StudentVerification model maps to collection: ${studentCollection}`);
        
        // Check the count of students
        const count = await StudentVerification.countDocuments();
        console.log(`Total number of students in the database: ${count}`);
        
        return true;
    } catch (error) {
        console.error('Error checking database status:', error);
        return false;
    }
}

// Check a few enrollment numbers from the new students
async function run() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/pinspire');
        console.log('Connected to MongoDB');
        
        // First check database status
        console.log('\n=== DATABASE STATUS ===');
        const dbStatus = await checkDatabaseStatus();
        if (!dbStatus) {
            console.error('Database issues detected. Please check your MongoDB connection and collections.');
            return;
        }
        
        console.log('\n=== TESTING NEW STUDENT RECORDS ===');
        // Test a few enrollment numbers
        const testEnrollmentNumbers = [
            "021322001", // Abhijith Prabhakar
            "021322007", // Diksha Khurana
            "021323801", // Abhishek Thapliyal
        ];
        
        let found = 0;
        for (const enrollmentNumber of testEnrollmentNumbers) {
            const exists = await verifyStudent(enrollmentNumber);
            if (exists) found++;
            console.log('-------------------');
        }
        
        console.log(`\nFound ${found} out of ${testEnrollmentNumbers.length} test students.`);
        
        if (found === 0) {
            console.log('\n❌ DIAGNOSIS: None of the new students appear to be in the database.');
            console.log('SOLUTION: Run the addNewStudents.js script with:');
            console.log('node scripts/addNewStudents.js');
        } else if (found < testEnrollmentNumbers.length) {
            console.log('\n⚠️ WARNING: Some of the new students are missing from the database.');
            console.log('SOLUTION: Run the addNewStudents.js script again to add missing students.');
        } else {
            console.log('\n✅ SUCCESS: All test students found in the database.');
            console.log('If you\'re still getting "Invalid enrollment number" errors, the issue might be:');
            console.log('1. The registration form might be using a different database connection');
            console.log('2. The enrollment number format might not match exactly (check for spaces, capitalization, etc.)');
            console.log('3. There could be application-level validation rules that are rejecting the enrollment numbers');
        }
        
    } catch (error) {
        console.error('Error running verification:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the verification
run(); 