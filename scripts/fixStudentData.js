// Script to fix student verification records
require('dotenv').config();
const mongoose = require('mongoose');
const students = require('../data/students');
const StudentVerification = require('../models/studentVerification');

async function fixStudentData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinspire');
    console.log('Connected to MongoDB');
    
    console.log(`Found ${students.length} students in data file`);
    
    // First, remove all existing records to avoid duplicates
    await StudentVerification.deleteMany({});
    console.log('Deleted all existing student verification records');
    
    // Insert fresh data from the students data file
    for (const student of students) {
      await StudentVerification.create({
        enrollment_number: student.enrollment_number,
        name: student.name,
        email: student.email,
        contact_number: student.contact,
        is_verified: false
      });
      console.log(`Created record for ${student.name} (${student.enrollment_number})`);
    }
    
    console.log('All student verification records fixed successfully!');
    
    // Verify a sample record
    const sampleStudent = await StudentVerification.findOne({ enrollment_number: '021323028' });
    console.log('Sample student record:', JSON.stringify(sampleStudent, null, 2));
    
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error fixing student data:', error);
    mongoose.disconnect();
  }
}

fixStudentData(); 