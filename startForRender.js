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

require('dotenv').config();
const { cloudinary } = require('./config/cloudinary');

// Verify Cloudinary configuration is working
console.log('Verifying Cloudinary configuration...');
try {
    // Try to get Cloudinary account details as a connectivity test
    cloudinary.api.ping()
        .then((result) => {
            console.log('✅ Cloudinary connection successful!');
            console.log(`Connected to Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

            // Start the main app
            console.log('Starting application...');
            require('./index.js');
        })
        .catch((error) => {
            console.error('❌ Cloudinary connection error:', error.message);
            console.error('Please check your Cloudinary credentials.');
            console.error('Starting application anyway...');
            require('./index.js');
        });
} catch (error) {
    console.error('❌ Cloudinary setup error:', error.message);
    console.error('Please check your Cloudinary credentials.');
    console.error('Starting application anyway...');
    require('./index.js');
} 