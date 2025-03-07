const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userModel = require('../models/user');

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await userModel.findOne({ email: profile.emails[0].value });
      
      if (user) {
        // User exists, update their Google profile info if needed
        return done(null, user);
      } else {
        // Create a new user with Google profile info
        const newUser = await userModel.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          username: profile.emails[0].value.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
          password: Math.random().toString(36).slice(-12) + Math.random().toString(36).toUpperCase().slice(-4) + '!', // Generate secure random password
          profileImage: profile.photos[0].value
        });
        
        return done(null, newUser);
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

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