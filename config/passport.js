const passport = require('passport');
// Commented out Google Strategy - will be implemented later
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userModel = require('../models/user');

// Get your credentials from:
// https://console.cloud.google.com/apis/credentials
// const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
// const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';

// // Log credential status (without revealing the actual values)
// console.log('Google OAuth client ID loaded:', Boolean(process.env.GOOGLE_CLIENT_ID) ? 'Yes' : 'No');
// console.log('Google OAuth client secret loaded:', Boolean(process.env.GOOGLE_CLIENT_SECRET) ? 'Yes' : 'No');
// console.log('Client ID ends with:', GOOGLE_CLIENT_ID.substring(GOOGLE_CLIENT_ID.length - 5));

// // Get the application URL from environment or default to localhost
// const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// // Configure Google OAuth strategy
// passport.use(new GoogleStrategy({
//     clientID: GOOGLE_CLIENT_ID,
//     clientSecret: GOOGLE_CLIENT_SECRET,
//     callbackURL: `${APP_URL}/auth/google/callback`,
//     passReqToCallback: true
//   },
//   async (req, accessToken, refreshToken, profile, done) => {
//     try {
//       console.log('Google profile received:', profile.displayName);
//       
//       // Check if user already exists
//       let user = await userModel.findOne({ email: profile.emails[0].value });
//       
//       if (user) {
//         // User exists, update their Google profile info if needed
//         console.log('Existing user logged in with Google:', user.email);
//         return done(null, user);
//       } else {
//         console.log('Creating new user from Google profile:', profile.emails[0].value);
//         // Create a new user with Google profile info
//         const newUser = await userModel.create({
//           name: profile.displayName,
//           email: profile.emails[0].value,
//           username: profile.emails[0].value.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
//           password: Math.random().toString(36).slice(-12) + Math.random().toString(36).toUpperCase().slice(-4) + '!', // Generate secure random password
//           profileImage: profile.photos[0].value
//         });
//         
//         return done(null, newUser);
//       }
//     } catch (error) {
//       console.error('Error in Google authentication:', error);
//       return done(error, null);
//     }
//   }
// ));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 