// Special startup script for Render deployment
console.log('Starting application with Render-specific configuration...');

// Force set environment variables if they're missing
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = process.env.MONGODB_URI || 
  "mongodb+srv://darshilaggarwal11:UbQoLdX99DmR21S1@cluster0.w9kvi8i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Set default port if not provided
process.env.PORT = process.env.PORT || 3000;

console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('MongoDB connection string is configured');

// Start the actual application
require('./index.js'); 