require('dotenv').config();
const mongoose = require('mongoose');
const os = require('os');

console.log('=== Server Diagnostics ===');
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('MongoDB URI:', process.env.MONGODB_URL || process.env.MONGODB_URI);
console.log('Total Memory:', Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB');
console.log('Free Memory:', Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB');
console.log('CPU Cores:', os.cpus().length);

async function testMongoDBConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const mongoURI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/jccbuzz';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connection successful');
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

// Test HTTP server
function checkPortAvailability(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is already in use`);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      console.log(`✅ Port ${port} is available`);
      resolve(true);
    });
    
    server.listen(port);
  });
}

async function runDiagnostics() {
  const mongoDBConnected = await testMongoDBConnection();
  const port = process.env.PORT || 3000;
  const portAvailable = await checkPortAvailability(port);
  
  console.log('\n=== Diagnostics Summary ===');
  console.log('MongoDB Connection:', mongoDBConnected ? 'Working' : 'FAILED');
  console.log('Port Availability:', portAvailable ? 'Available' : 'IN USE');
  
  if (!mongoDBConnected) {
    console.log('\nTroubleshooting MongoDB:');
    console.log('1. Make sure MongoDB is running');
    console.log('2. Check if the MongoDB URI in your .env file is correct');
    console.log('3. Verify network connectivity to the MongoDB server');
  }
  
  if (!portAvailable) {
    console.log('\nTroubleshooting Port:');
    console.log('1. Another process may be using the port');
    console.log('2. Run "lsof -i :' + port + '" to identify the process');
    console.log('3. Change the PORT in your .env file or stop the conflicting process');
  }
}

runDiagnostics(); 