require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('./models/studentVerification');

const enrollmentToCheck = '021323008';

async function checkEnrollmentNumber() {
  try {
    console.log(`Checking enrollment number: ${enrollmentToCheck}`);
    
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');
    
    // Find the student
    const student = await StudentVerification.findOne({ enrollment_number: enrollmentToCheck });
    
    if (student) {
      console.log('✅ Student found:');
      console.log(`Enrollment: ${student.enrollment_number}`);
      console.log(`Name: ${student.name || 'Not set'}`);
      console.log(`Email: ${student.email || 'Not set'}`);
      console.log(`Contact: ${student.contact_number || 'Not set'}`);
      console.log(`Verified: ${student.is_verified ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Student with enrollment number ${enrollmentToCheck} NOT FOUND in database`);
      
      // Check for students with similar enrollment numbers
      console.log('\nSearching for similar enrollment numbers:');
      const similarStudents = await StudentVerification.find({ 
        enrollment_number: { $regex: enrollmentToCheck.substring(0, 5) } 
      }).limit(5);
      
      if (similarStudents.length > 0) {
        console.log('Similar enrollment numbers found:');
        similarStudents.forEach(s => console.log(`- ${s.enrollment_number}`));
      } else {
        console.log('No similar enrollment numbers found');
      }
      
      // Count total students
      const totalCount = await StudentVerification.countDocuments();
      console.log(`\nTotal students in database: ${totalCount}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkEnrollmentNumber(); 