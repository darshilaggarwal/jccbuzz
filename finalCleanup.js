// Final cleanup to remove any remaining sample data students
require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('./models/studentVerification');

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// List of fake students to remove by enrollment number
const fakeStudentsToRemove = [
  '021322008',   // Sneha Verma
  '021323805'    // Deepak Trivedi
];

async function removeRemainingFakeStudents() {
  try {
    console.log('Starting final cleanup...');
    
    // Remove each fake student
    for (const enrollmentNumber of fakeStudentsToRemove) {
      const result = await StudentVerification.deleteOne({ enrollment_number: enrollmentNumber });
      if (result.deletedCount > 0) {
        console.log(`Successfully removed student with enrollment number: ${enrollmentNumber}`);
      } else {
        console.log(`No student found with enrollment number: ${enrollmentNumber}`);
      }
    }
    
    // List all remaining students
    const remainingStudents = await StudentVerification.find({}).select('enrollment_number name email');
    console.log(`\nDatabase now has ${remainingStudents.length} students:`);
    remainingStudents.forEach(student => {
      console.log(`- ${student.enrollment_number}: ${student.name} (${student.email})`);
    });
    
    console.log('\nFinal cleanup completed!');
  } catch (error) {
    console.error('Error during final cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the cleanup
removeRemainingFakeStudents(); 