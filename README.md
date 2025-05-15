# JCCBuzz

A social media platform for JCC college students.

## Features

- User authentication with enrollment verification
- Profile creation and customization
- Post sharing with images
- Stories with image upload
- User following system
- Comments and likes on posts
- Real-time chat
- Dark mode support

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB Atlas account
- Cloudinary account (for media storage)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd jccbuzz
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://your_mongodb_atlas_uri
   JWT_SECRET=your_jwt_secret
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_email_app_password
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. Setup Cloudinary (required for image uploads):
   - Sign up for a free account at [cloudinary.com](https://cloudinary.com/)
   - Get your cloud name, API key, and API secret from the dashboard
   - Add these values to your `.env` file

5. Start the application:
   ```
   npm start
   ```

## Deployment

### Render Deployment

1. Push your code to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set the following:
   - Build Command: `npm install`
   - Start Command: `node startForRender.js`
5. Add all environment variables from your `.env` file
6. Deploy!

## Media Storage

This application uses Cloudinary for persistent file storage, which ensures that all uploaded content (posts, profile pictures, stories) remains available even after redeploying the application.

### Image Storage Details

- **Posts**: Images uploaded with posts are resized, optimized, and stored on Cloudinary in the `jccbuzz/posts` folder.
- **Profile Photos**: User profile pictures are stored in the `jccbuzz/profiles` folder.
- **Chat Media**: Media shared in chat conversations are stored in the `jccbuzz/chat` folder.
- **Events**: Event images are stored in the `jccbuzz/events` folder.

Unlike local file storage which is lost when redeploying on services like Render, Cloudinary provides a permanent and reliable solution for storing user-generated content. The free tier includes:

- 25GB of storage
- 25GB of monthly bandwidth
- Basic transformations

If you hit the free tier limits, Cloudinary offers paid plans with higher capacity.

### Migrating Local Event Images to Cloudinary

If you have event images stored locally that need to be migrated to Cloudinary, run:

```
npm run migrate-event-images
```

This will:
1. Find all events with local image paths
2. Upload each image to Cloudinary
3. Update the event records with the new Cloudinary URLs
4. Log the migration results

## License

[MIT](LICENSE) 