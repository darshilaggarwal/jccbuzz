// Script to add new student verification data
require('dotenv').config();
const mongoose = require('mongoose');
const StudentVerification = require('../models/studentVerification');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/pinspire')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// New student data to add
const newStudents = [
    {"enrollment_number": "021322001", "name": "Abhijith Prabhakar", "contact": "9891155892", "email": "abhijithprabhakar123@gmail.com"},
    {"enrollment_number": "021322002", "name": "Aditya Kumar", "contact": "8384061990", "email": "22adityathakur@gmail.com"},
    {"enrollment_number": "021322003", "name": "Ankit kumar mittal", "contact": "7065873643", "email": "akm787614@gmail.com"},
    {"enrollment_number": "021322004", "name": "Anmol Aggarwal", "contact": "7015331647", "email": "anmolaggarwal8685@gmail.com"},
    {"enrollment_number": "021322005", "name": "ANSHUL PARJAPATI", "contact": "8595564800", "email": "ANSHULPARJAPATI12345@GMAIL.COM"},
    {"enrollment_number": "021322006", "name": "Chanchala", "contact": "9311569748", "email": "chanchalawason@gmail.com"},
    {"enrollment_number": "021322007", "name": "Diksha Khurana", "contact": "9289061663", "email": "lifendcareer2022@gmail.com"},
    {"enrollment_number": "021322009", "name": "Farhad Khan", "contact": "9315686503", "email": "farhadrizwan0786@gmail.com"},
    {"enrollment_number": "021322010", "name": "Harish Kumar", "contact": "7056213644", "email": "hryadav7056@gmail.com"},
    {"enrollment_number": "021322011", "name": "HARSH GOYAL", "contact": "8178427206", "email": "Tgharsh17@gmail.com"},
    {"enrollment_number": "021322012", "name": "Harshit Malik", "contact": "9667480134", "email": "harshitmalik29@gmail.com"},
    {"enrollment_number": "021322013", "name": "Himanshu", "contact": "9718783633", "email": "18himanshubh@gmail.com"},
    {"enrollment_number": "021322014", "name": "Jatin kumar", "contact": "8059445474", "email": "raojatin8221@gmail.com"},
    {"enrollment_number": "021322015", "name": "Kalpana bhardwaj", "contact": "8178944332", "email": "kalpanabhardwaj323@gmail.com"},
    {"enrollment_number": "021322016", "name": "Kunal yadav", "contact": "8595882880", "email": "Ky577502@gmail.com"},
    {"enrollment_number": "021322019", "name": "Prakriti", "contact": "8076280302", "email": "prakritisrishti03@gmail.com"},
    {"enrollment_number": "021322020", "name": "Preetish Kumar Gupta", "contact": "7980131039", "email": "preetishgupta1604@gmail.com"},
    {"enrollment_number": "021322021", "name": "Raghvendra kumar", "contact": "7091150583", "email": "raghvendrakumar70911@gmail.com"},
    {"enrollment_number": "021322022", "name": "Sumanyu Harjai", "contact": "9990836706", "email": "hardikhappy73@gmail.com"},
    {"enrollment_number": "021322023", "name": "Vansh Imlani", "contact": "9310149630", "email": "bhutanivansh16@gmail.com"},
    {"enrollment_number": "021322024", "name": "Vinay", "contact": "7404115990", "email": "kumarvinaydahiya004@gmail.com"},
    {"enrollment_number": "021323801", "name": "Abhishek Thapliyal ", "contact": "7042490638", "email": "abhishekthapyal8@gmail.com"},
    {"enrollment_number": "021323802", "name": "Konain Fatima ", "contact": "8506058213", "email": "konainfatima28@gmail.com"},
    {"enrollment_number": "021323803", "name": "Akanksha", "contact": "9312341100", "email": "asrathore2503@gmail.com"},
    {"enrollment_number": "021323804", "name": "Manas ", "contact": "8287846225", "email": "kharemanas93@gmail.com"}
];

// Function to add new student verification data
async function addNewStudents() {
    try {
        console.log(`Adding ${newStudents.length} new student records...`);
        
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Process each student and create or update records
        for (const student of newStudents) {
            // Check if student already exists
            const existingStudent = await StudentVerification.findOne({ 
                enrollment_number: student.enrollment_number 
            });
            
            if (existingStudent) {
                // Update existing record
                existingStudent.name = student.name;
                existingStudent.email = student.email;
                existingStudent.contact_number = student.contact;
                await existingStudent.save();
                updatedCount++;
                console.log(`Updated student: ${student.enrollment_number} - ${student.name}`);
            } else {
                // Create new record
                await StudentVerification.create({
                    enrollment_number: student.enrollment_number,
                    name: student.name,
                    email: student.email,
                    contact_number: student.contact,
                    is_verified: false
                });
                addedCount++;
                console.log(`Added new student: ${student.enrollment_number} - ${student.name}`);
            }
        }

        console.log('-------------------------------------------');
        console.log(`Added: ${addedCount} new student records`);
        console.log(`Updated: ${updatedCount} existing student records`);
        console.log(`Skipped: ${skippedCount} student records`);
        console.log('-------------------------------------------');
        console.log('Operation completed successfully!');
        
        // Verify total count after additions
        const totalCount = await StudentVerification.countDocuments();
        console.log(`Total students in database: ${totalCount}`);
        
    } catch (error) {
        console.error('Error adding new student data:', error);
    } finally {
        mongoose.disconnect();
    }
}

// Run the function
addNewStudents(); 