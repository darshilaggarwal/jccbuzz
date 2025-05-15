require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { uploadToCloudinary } = require('../config/cloudinary');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/jccbuzz')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Import Event model
const Event = require('../models/Event');

// Path to event uploads directory
const eventUploadDir = path.join(__dirname, '../public/uploads/events');

async function migrateEventImages() {
  console.log('Starting migration of event images to Cloudinary...');
  
  try {
    // Get all events from the database
    const events = await Event.find({});
    console.log(`Found ${events.length} events to process`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const event of events) {
      try {
        // Check if the image is already on Cloudinary
        if (event.image && event.image.includes('cloudinary.com')) {
          console.log(`Event ${event._id}: Image already on Cloudinary, skipping`);
          skippedCount++;
          continue;
        }
        
        // Check if the image is a local path
        if (event.image && event.image.startsWith('/uploads/events/')) {
          const imageName = path.basename(event.image);
          const imagePath = path.join(eventUploadDir, imageName);
          
          // Check if file exists
          if (fs.existsSync(imagePath)) {
            console.log(`Event ${event._id}: Migrating image ${imageName} to Cloudinary`);
            
            try {
              // Process image with sharp first to optimize
              const processedBuffer = await sharp(imagePath)
                .resize(1080, 720, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();
              
              // Upload processed image to Cloudinary
              const result = await uploadToCloudinary(processedBuffer, {
                folder: 'jccbuzz/events'
              });
              
              console.log(`Event ${event._id}: Uploaded to Cloudinary: ${result.secure_url}`);
              
              // Update event with new Cloudinary URL
              event.image = result.secure_url;
              await event.save();
              console.log(`Event ${event._id}: Updated with Cloudinary URL`);
              
              migratedCount++;
            } catch (uploadError) {
              console.error(`Event ${event._id}: Error uploading to Cloudinary:`, uploadError);
              errorCount++;
            }
          } else {
            console.log(`Event ${event._id}: Image file not found at ${imagePath}, skipping`);
            // Update to use default image if file not found
            event.image = '/images/default-event.jpg';
            await event.save();
            skippedCount++;
          }
        } else if (event.image && event.image === '/images/default-event.jpg') {
          // Default image, no need to migrate
          console.log(`Event ${event._id}: Using default image, skipping`);
          skippedCount++;
        } else {
          console.log(`Event ${event._id}: No image or unrecognized format, skipping`);
          // Update to use default image
          event.image = '/images/default-event.jpg';
          await event.save();
          skippedCount++;
        }
      } catch (eventError) {
        console.error(`Error processing event ${event._id}:`, eventError);
        errorCount++;
      }
    }
    
    console.log('Migration completed:');
    console.log(`- Total events: ${events.length}`);
    console.log(`- Migrated: ${migratedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close database connection
    mongoose.connection.close();
  }
}

// Run the migration
migrateEventImages(); 