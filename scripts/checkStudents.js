// Script to check student verification records
require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('../models/studentVerification');

async function checkStudentData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinspire');
    console.log('Connected to MongoDB');
    
    // Check a specific student record
    const student = await StudentVerification.findOne({ enrollment_number: '021323028' });
    console.log('Student record:', JSON.stringify(student, null, 2));
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

checkStudentData(); 