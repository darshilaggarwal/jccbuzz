const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwobhvyas',
  api_key: process.env.CLOUDINARY_API_KEY || '314364353519465',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// For debugging
console.log('Cloudinary configured with cloud name:', process.env.CLOUDINARY_CLOUD_NAME || 'dwobhvyas');

/**
 * Upload a file to Cloudinary
 * @param {Buffer|String} file - File buffer or path to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
exports.uploadToCloudinary = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || 'jccbuzz',
      resource_type: options.resourceType || 'auto',
      ...options
    };

    // For debugging
    console.log(`Uploading to Cloudinary folder: ${uploadOptions.folder}`);

    // If file is a buffer (from multer memory storage)
    if (Buffer.isBuffer(file)) {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          console.log('Cloudinary upload success, URL:', result.secure_url);
          resolve(result);
        }
      );
      
      uploadStream.end(file);
    }
    // If file has a buffer property (from multer)
    else if (file && file.buffer && Buffer.isBuffer(file.buffer)) {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          console.log('Cloudinary upload success, URL:', result.secure_url);
          resolve(result);
        }
      );
      
      uploadStream.end(file.buffer);
    }
    // If file is a path (string), use upload
    else if (typeof file === 'string') {
      cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        console.log('Cloudinary upload success, URL:', result.secure_url);
        resolve(result);
      });
    } 
    // Handle other cases
    else {
      console.error('Invalid file format:', typeof file);
      reject(new Error('Invalid file format for Cloudinary upload'));
    }
  });
};

// Extract public_id from Cloudinary URL
exports.getPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // Check if it's a Cloudinary URL
  if (!url.includes('cloudinary.com')) return null;
  
  const parts = url.split('/');
  // Get the filename without extension
  const filenameWithExtension = parts[parts.length - 1];
  const filename = filenameWithExtension.split('.')[0];
  
  // The folder is typically the value after 'upload/'
  const uploadIndex = parts.indexOf('upload');
  
  if (uploadIndex !== -1 && uploadIndex < parts.length - 2) {
    // Combine all path parts after 'upload' and before the filename
    const folderPath = parts.slice(uploadIndex + 1, parts.length - 1).join('/');
    return `${folderPath}/${filename}`;
  }
  
  return filename;
};

// Delete a file from Cloudinary
exports.deleteFromCloudinary = async (publicId, options = {}) => {
  if (!publicId) return null;
  
  try {
    const result = await cloudinary.uploader.destroy(
      publicId, 
      { resource_type: options.resourceType || 'image', ...options }
    );
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Export cloudinary instance
exports.cloudinary = cloudinary; 