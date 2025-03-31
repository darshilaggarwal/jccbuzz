// Database setup and verification script
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

console.log('Running setup and verification script...');
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Ensure required directories exist
const directories = [
  'public',
  'public/uploads',
  'public/uploads/profiles',
  'public/uploads/posts',
  'public/uploads/stories',
  'public/uploads/events',
  'public/images',
  'logs'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Connect to MongoDB
async function verifyDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGODB_URI environment variable is not set');
      return false;
    }
    
    // Hide sensitive parts of the connection string in logs
    const redactedURI = mongoURI.replace(/:([^:@]+)@/, ':****@');
    console.log('MongoDB URI:', redactedURI);
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Atlas connection successful');
    
    // Verify collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    if (collections.length === 0) {
      console.log('⚠️ No collections found. Database may be empty.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

// Verify environment variables
function checkEnvironment() {
  const requiredVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.log('⚠️ Missing environment variables:', missingVars.join(', '));
    console.log('Some features may not work correctly.');
  } else {
    console.log('✅ Required environment variables are set');
  }
}

// Main function
async function setup() {
  checkEnvironment();
  const dbConnected = await verifyDatabase();
  
  if (dbConnected) {
    console.log('\n✅ Setup complete. System is ready to run.');
  } else {
    console.log('\n⚠️ Setup completed with warnings. Please check the logs.');
  }
}

setup(); 