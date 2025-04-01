// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const userModel = require('./models/user');
const postModel = require('./models/post');
const commentModel = require('./models/comment');
const chatModel = require('./models/chat');
const storyModel = require('./models/story');
const notificationModel = require('./models/notification');
const Project = require('./models/Project');
const StudentVerification = require('./models/studentVerification');
const LoginVerification = require('./models/loginVerification');
const Event = require('./models/Event');
const { sendOTPEmail } = require('./utils/emailSender');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const session = require('express-session');
const passport = require('passport');
const http = require('http');
const socketIo = require('socket.io');
const { Server } = require('socket.io');
// const LocalStrategy = require('passport-local').Strategy;
const socketModule = require('./socket/socket');
const { cloudinary, uploadToCloudinary, getPublicIdFromUrl, deleteFromCloudinary } = require('./config/cloudinary');

// Create HTTP server and Socket.io instance
const server = http.createServer(app);

// Initialize to undefined, will be set after server starts
global.io = undefined;

// Make io available globally for notification real-time updates
global.io = io;

// Add this near the top of the file where other environment variables are setup
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";

// MongoDB connection
const MONGODB_ATLAS_URI = "mongodb+srv://darshilaggarwal11:UbQoLdX99DmR21S1@cluster0.w9kvi8i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const MONGODB_LOCAL_URI = "mongodb://localhost:27017/pinspire";

// Use Atlas in production, local in development
const MONGODB_URI = process.env.NODE_ENV === 'production' 
  ? MONGODB_ATLAS_URI 
  : (process.env.MONGODB_URI || MONGODB_LOCAL_URI);

console.log('MongoDB connection string (redacted):', 
  MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));
console.log('Environment:', process.env.NODE_ENV);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

// Add this near the top where other directories are created
const uploadDir = 'public/uploads/profiles';
const postUploadDir = 'public/uploads/posts';
const storyUploadDir = 'public/uploads/stories';
const eventUploadDir = 'public/uploads/events';
const defaultProfileImagePath = path.join('public/images/default-profile.png');

if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(postUploadDir)){
    fs.mkdirSync(postUploadDir, { recursive: true });
}
if (!fs.existsSync(storyUploadDir)){
    fs.mkdirSync(storyUploadDir, { recursive: true });
}
if (!fs.existsSync(eventUploadDir)){
    fs.mkdirSync(eventUploadDir, { recursive: true });
}

if (!fs.existsSync(defaultProfileImagePath)) {
    // Copy a default image from your assets or create a simple one
    const sourcePath = path.join(__dirname, 'assets/default-profile.png');
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, defaultProfileImagePath);
    } else {
        console.error('Default profile image not found in assets.');
    }
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        // Accept a wider range of image formats
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp|tiff/i;
        
        // Check file extension
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        // Check mime type
        const mimetypeAllowed = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'image/bmp',
            'image/tiff'
        ].includes(file.mimetype);

        if (extname && mimetypeAllowed) {
            return cb(null, true);
        } else {
            return cb(new Error('Only image files are allowed! (jpg, jpeg, png, gif, webp, svg, bmp, tiff)'), false);
        }
    }
}).single('profileImage');

// Configure multer for post images
const postStorage = multer.memoryStorage();
const uploadPostImages = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Configure multer for profile pictures
const profileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Configure multer for story upload
const storyStorage = multer.memoryStorage();
const uploadStory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image or video files are allowed'), false);
        }
    }
});

// Configure multer storage for chat media uploads
const chatMediaStorage = multer.memoryStorage();
const chatMediaFilter = function (req, file, cb) {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed'), false);
    }
};

const uploadChatMedia = multer({ 
    storage: chatMediaStorage,
    fileFilter: chatMediaFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
}).single('media');

// Add voice message upload configuration
const uploadVoiceStorage = multer.memoryStorage();
const uploadVoice = multer({
    storage: uploadVoiceStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
}).single('voice');

// Configure storage for event images
const eventStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, eventUploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, 'event-' + Date.now() + path.extname(file.originalname))
    }
});

const uploadEventImage = multer({ 
    storage: eventStorage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/i;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Images Only!'));
        }
    }
}).single('image');

// Serve static files
app.use(express.static('public'));

// Initialize express-session middleware
app.use(session({
    secret: 'shhhh',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true if using https
}));

// Initialize passport and session
app.use(passport.initialize());
app.use(passport.session());

app.get("/" , (req,res)=>{
    res.render("landing")
})

app.get("/profile" ,isLoggedIn ,  async (req,res)=>{
    try {
        // First try to find by ID if available
        let user;
        if (req.user._id) {
            user = await userModel.findById(req.user._id);
        }
        
        // If not found by ID, try email
        if (!user && req.user.email) {
            user = await userModel.findOne({email: req.user.email});
        }

        if (!user) {
            return res.redirect("/login");
        }

        // Populate all necessary data
        user = await userModel.findById(user._id)
            .populate({
                path: 'posts',
                options: { sort: { createdAt: -1 } }, // Sort posts by newest first
                populate: {
                    path: 'user',
                    select: 'username name profileImage'
                }
            })
            .populate('followers')
            .populate('following')
            .populate({
                path: 'followRequests.user',
                select: 'name username profileImage'
            });
        
        res.render("profile", {user});
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect("/login");
    }
});

app.get("/edit/:id" ,isLoggedIn ,  async (req,res)=>{
    const id = req.params.id.trim();
    const post = await postModel.findById(id);
    const user = await userModel.findOne({ email: req.user.email });
    res.render("edit"  , {post, user})
})


app.post("/post", isLoggedIn, uploadPostImages.array('processedImages'), async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!req.body.title || !req.body.content) {
            return res.status(400).send("Title and content are required");
        }
        
        const { title, content } = req.body;
        
        // Get cloudinary upload function
        const { uploadToCloudinary } = require('./config/cloudinary');
        
        console.log(`Processing ${req.files ? req.files.length : 0} images for post`);
        
        // Process images
        let processedImages = [];
        if (req.files && req.files.length > 0) {
            processedImages = await Promise.all(
                req.files.map(async (file, index) => {
                    console.log(`Processing image ${index + 1} for post`);
                    
                    // Process image with sharp first to optimize
                    const processedBuffer = await sharp(file.buffer)
                        .resize(1080, 1080, { fit: 'inside' })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                    
                    // Upload processed image to Cloudinary
                    const result = await uploadToCloudinary(processedBuffer, {
                        folder: 'jccbuzz/posts'
                    });
                    
                    console.log(`Image ${index + 1} uploaded to Cloudinary: ${result.secure_url}`);
                    
                    return {
                        url: result.secure_url,
                        aspectRatio: 1
                    };
                })
            );
        }

        const post = await postModel.create({
            title,
            content,
            images: processedImages,
            user: user._id
        });

        await post.populate('user', 'username name profileImage');
        
        user.posts.push(post._id);
        await user.save();
        
        // Send real-time update for feed
        io.emit('newPost', {
            post: {
                _id: post._id,
                title: post.title,
                content: post.content,
                images: post.images,
                user: post.user,
                likes: [],
                comments: [],
                createdAt: post.createdAt
            }
        });
        
        // Notify all followers about the new post
        try {
            // Get all followers of this user
            const followers = await userModel.find({ following: user._id });
            const followerIds = followers.map(follower => follower._id.toString());
            
            // Send socket notification to online followers
            const socketHandler = require('./socket/socket');
            socketHandler.getIO().emit('newPostNotification', {
                senderId: user._id,
                followers: followerIds,
                postId: post._id
            });
            
            // Create notifications for each follower
            for (const follower of followers) {
                const notification = await notificationModel.create({
                    recipient: follower._id,
                    sender: user._id,
                    type: 'new_post',
                    title: 'New Post',
                    message: `${user.name || 'Someone you follow'} shared a new post`,
                    data: { postId: post._id }
                });
                
                // If the notification was created successfully and the follower isn't online,
                // make sure it's saved for when they log in next
                if (notification && !socketHandler.getIO().sockets.adapter.rooms.has(`user:${follower._id}`)) {
                    console.log(`Saved notification for offline user ${follower._id}`);
                }
            }
            
            console.log(`Notified ${followers.length} followers about new post`);
        } catch (notificationError) {
            console.error('Error sending follower notifications:', notificationError);
            // Continue execution even if notifications fail
        }
        
        res.status(200).json({ message: "Post created successfully" });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: "Error creating post" });
    }
});

app.get("/login" , (req,res)=>{
    res.render("login")
})

app.get("/register" , (req,res)=>{
    res.render("register")
})

app.post("/register" ,async (req,res)=>{
    try {
        let { email, username, name, password, enrollment_number } = req.body;
    
        if (!enrollment_number) {
            return res.redirect("/register?error=invalid_enrollment");
        }
        
        // Verify that the enrollment number is valid and verified
        const student = await StudentVerification.findOne({ enrollment_number });
        if (!student) {
            return res.redirect("/register?error=invalid_enrollment");
        }
        
        if (!student.is_verified) {
            return res.redirect("/register?error=not_verified");
        }
        
        // Check if enrollment number is already registered
        const enrollmentUser = await userModel.findOne({ enrollment_number });
        if (enrollmentUser) {
            return res.redirect("/register?error=enrollment_taken");
        }
        
        // Check if email already exists
        let emailUser = await userModel.findOne({ email });
        if (emailUser) {
            return res.redirect("/register?error=email_taken");
        }
        
        // Check if username already exists
        let usernameUser = await userModel.findOne({ username });
        if (usernameUser) {
            return res.redirect("/register?error=username_taken");
        }

        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(password, salt, async (err, hash) => {
                try {
                    let user = await userModel.create({
                        name, 
                        email, 
                        username, 
                        password: hash,
                        enrollment_number,
                        posts: [] // Initialize empty posts array
                    });

                    let token = jwt.sign({ email: email }, JWT_SECRET);
                    res.cookie("token", token);
                    // Instead of directly rendering, redirect to profile
                    res.redirect("/profile");
                } catch (error) {
                    console.error("Error creating user:", error);
                    return res.redirect("/register?error=registration_failed");
                }
            });
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.redirect("/register?error=registration_failed");
    }
})

// Add this helper function for masking emails
function maskEmail(email) {
    try {
        if (!email || typeof email !== 'string') {
            console.log("Invalid email to mask:", email);
            return '';
        }
        
        console.log("Masking email:", email);
        
        // Split email at @ symbol
        const atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            console.log("Invalid email format (no @ symbol):", email);
            return email;
        }
        
        // Extract username and domain parts
        const username = email.substring(0, atIndex);
        const domain = email.substring(atIndex);
        
        console.log("Username part:", username, "Domain part:", domain);
        
        // Check if username is too short to mask
        if (username.length <= 2) {
            console.log("Username too short to mask");
            return email;
        }
        
        // Create masked version showing only first and last character
        const firstChar = username.charAt(0);
        const lastChar = username.charAt(username.length - 1);
        const asterisks = '*'.repeat(username.length - 2);
        
        const masked = firstChar + asterisks + lastChar + domain;
        console.log("Final masked email:", masked);
        
        return masked;
    } catch (error) {
        console.error("Error in maskEmail function:", error);
        return email; // Return original email if any error occurs
    }
}

app.post("/login", async (req, res) => {
    try {
        let { identifier, password } = req.body;

        // Look for user by email or username
        let user = await userModel.findOne({ 
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });
        
        if (!user) {
            console.log('Login attempt with non-existent identifier:', identifier);
            return res.redirect("/login?error=invalid_credentials");
        }

        bcrypt.compare(password, user.password, async (err, result) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.redirect("/login?error=login_error");
            }
            
            if (result) {
                try {
                    // Create a temporary login token
                    const loginToken = jwt.sign({ 
                        userId: user._id,
                        email: user.email,
                        type: 'login_verification',
                        timestamp: Date.now()
                    }, JWT_SECRET, { expiresIn: '5m' });
                    
                    // Generate OTP
                    const otp = generateOTP();
                    const expiresAt = new Date();
                    expiresAt.setMinutes(expiresAt.getMinutes() + 2); // OTP expires in 2 minutes
                    
                    // Save login verification data
                    await LoginVerification.create({
                        userId: user._id,
                        email: user.email,
                        token: loginToken,
                        otp: {
                            code: otp,
                            expiresAt: expiresAt
                        }
                    });
                    
                    // Log OTP in the terminal for both development and production
                    console.log("=====================================================");
                    console.log(`LOGIN OTP ${otp} generated for ${user.name} (${user.email})`);
                    console.log("This OTP will expire at:", expiresAt);
                    console.log("=====================================================");
                    
                    // Send OTP email
                    await sendOTPEmail(user.email, otp, user.name);
                    
                    // If in development mode, log the OTP (for testing)
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Login OTP for ${user.email}: ${otp}`);
                    }
                    
                    // Create masked email for display
                    const maskedEmail = maskEmail(user.email);
                    console.log("Email for template:", user.email);
                    console.log("Masked email for template:", maskedEmail);
                    
                    // Redirect to OTP verification page
                    return res.render("login-verify-otp", { 
                        email: user.email,
                        maskedEmail: maskedEmail,
                        loginToken: loginToken
                    });
                } catch (error) {
                    console.error('Error generating login OTP:', error);
                    return res.redirect("/login?error=login_error");
                }
            }
            
            console.log('Failed login attempt for user:', identifier);
            res.redirect("/login?error=invalid_credentials");
        });
    } catch (error) {
        console.error('Login error:', error);
        res.redirect("/login?error=login_error");
    }
});

// Verify login OTP
app.post("/verify-login-otp", async (req, res) => {
    try {
        const { otp, loginToken } = req.body;
        
        if (!otp || !loginToken) {
            return res.status(400).json({ error: "Verification code and login token are required" });
        }
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(loginToken, JWT_SECRET);
            if (decoded.type !== 'login_verification') {
                return res.status(400).json({ error: "Invalid login token" });
            }
        } catch (err) {
            console.error('Invalid or expired login token:', err);
            return res.status(400).json({ error: "Login session expired. Please login again." });
        }
        
        // Find the verification record
        const verification = await LoginVerification.findOne({ token: loginToken });
        
        if (!verification) {
            return res.status(400).json({ error: "Verification record not found. Please login again." });
        }
        
        // Check if already verified
        if (verification.isVerified) {
            return res.status(400).json({ error: "This session is already verified. Please login again." });
        }
        
        // Check if OTP has expired
        if (new Date() > new Date(verification.otp.expiresAt)) {
            return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
        }
        
        // Verify OTP
        if (verification.otp.code !== otp) {
            return res.status(400).json({ error: "Invalid verification code. Please try again." });
        }
        
        // Mark as verified
        verification.isVerified = true;
        await verification.save();
        
        // Find the user
        const user = await userModel.findById(decoded.userId);
        
        if (!user) {
            return res.status(400).json({ error: "User not found" });
        }
        
        // Generate the final authentication token
        const token = jwt.sign({ 
            name: user.name,
            email: user.email 
        }, JWT_SECRET);
        
        // Set cookie
        res.cookie("token", token);
        
        // Return success
        return res.json({ success: true });
    } catch (error) {
        console.error('Error verifying login OTP:', error);
        return res.status(500).json({ error: "Error verifying code. Please try again." });
    }
});

// Resend login OTP
app.post("/resend-login-otp", async (req, res) => {
    try {
        const { loginToken } = req.body;
        
        if (!loginToken) {
            return res.status(400).json({ error: "Login token is required" });
        }
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(loginToken, JWT_SECRET);
            if (decoded.type !== 'login_verification') {
                return res.status(400).json({ error: "Invalid login token" });
            }
        } catch (err) {
            console.error('Invalid or expired login token:', err);
            return res.status(400).json({ error: "Login session expired. Please login again." });
        }
        
        // Find the verification record
        const verification = await LoginVerification.findOne({ token: loginToken });
        
        if (!verification) {
            return res.status(400).json({ error: "Verification record not found. Please login again." });
        }
        
        // Check if already verified
        if (verification.isVerified) {
            return res.status(400).json({ error: "This session is already verified. Please login again." });
        }
        
        // Find the user
        const user = await userModel.findById(decoded.userId);
        
        if (!user) {
            return res.status(400).json({ error: "User not found" });
        }
        
        // Generate new OTP
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 2); // OTP expires in 2 minutes
        
        // Update verification record
        verification.otp = {
            code: otp,
            expiresAt: expiresAt,
            createdAt: new Date()
        };
        await verification.save();
        
        // Log OTP in the terminal for both development and production
        console.log("=====================================================");
        console.log(`LOGIN OTP ${otp} generated for ${user.name} (${user.email})`);
        console.log("This OTP will expire at:", expiresAt);
        console.log("=====================================================");
        
        // Send OTP email
        await sendOTPEmail(user.email, otp, user.name);
        
        // Generate masked email for response
        const maskedEmail = maskEmail(user.email);
        
        // If in development mode, log the OTP (for testing)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Resent login OTP for ${user.email}: ${otp}`);
        }
        
        // Return success
        return res.json({ 
            success: true,
            maskedEmail: maskedEmail 
        });
    } catch (error) {
        console.error('Error resending login OTP:', error);
        return res.status(500).json({ error: "Error resending code. Please try again." });
    }
});
  
app.get("/logout", (req, res) => {
    // Clear JWT cookie
    res.cookie("token", "");
    
    // Clear Passport session
    if (req.logout) {
        req.logout(function(err) {
            if (err) { 
                console.error('Error during logout:', err);
            }
            res.redirect("/");
        });
    } else {
        res.redirect("/");
    }
});

function isLoggedIn(req, res, next) {
    // Check for passport session-based authentication first
    if (req.isAuthenticated && req.isAuthenticated()) {
        console.log('User authenticated via Passport session');
        return next();
    }
    
    // Fall back to JWT token-based authentication
    if (!req.cookies.token || req.cookies.token === "") {
        console.log('No authentication token found, redirecting to login');
        return res.redirect("/login");
    }

    try {
        let data = jwt.verify(req.cookies.token, JWT_SECRET);
        // First try to find the user by email
        userModel.findOne({ email: data.email })
            .then(user => {
                if (!user) {
                    console.error('User not found in database');
                    return res.redirect("/login");
                }
                // Set the user object with the correct structure
                req.user = {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username
                };
                console.log('User authenticated via JWT:', req.user);
                next();
            })
            .catch(error => {
                console.error('Error finding user:', error);
                res.redirect("/login");
            });
    } catch (error) {
        console.error('JWT verification error:', error);
        res.redirect("/login?error=session_expired");
    }
}

// Export the middleware
module.exports = {
    isLoggedIn
};

app.post("/update/:id", isLoggedIn, async (req, res) => {
    const id = req.params.id.trim();
    await postModel.findByIdAndUpdate(id, { content: req.body.content });
    res.redirect("/profile");
});

app.get("/delete/:id", isLoggedIn, async (req, res) => {
    const id = req.params.id.trim();
    const user = await userModel.findOne({ email: req.user.email });
    
    // Remove post from user's posts array
    user.posts = user.posts.filter(postId => postId.toString() !== id);
    await user.save();
    
    // Delete the post
    await postModel.findByIdAndDelete(id);
    
    res.redirect("/profile");
});

app.get("/feed", isLoggedIn, async (req, res) => {
    try {
        // Find current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id)
                .populate('following', '_id');
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email })
                .populate('following', '_id');
        }

        if (!currentUser) {
            return res.redirect('/login');
        }

        // Get IDs of users the current user is following
        const followingIds = currentUser.following.map(user => user._id);
        
        // Check if the user is following anyone
        const isNewUser = followingIds.length === 0;
        
        // For new users, fetch suggested users
        let suggestedUsers = [];
        if (isNewUser) {
            suggestedUsers = await userModel.find({ 
                _id: { $ne: currentUser._id }
            })
            .select('username name profileImage bio')
            .limit(10);
        }
        
        // For users who follow people, fetch posts from those users
        // Include the current user's posts in the feed as well
        const followingIdsWithCurrentUser = [...followingIds, currentUser._id];
        const posts = await postModel.find({ 
                user: { 
                    $in: isNewUser ? [] : followingIdsWithCurrentUser 
                }
            })
            .populate('user', 'username name profileImage hasActiveStory location')
            .populate({
                path: 'comments',
                populate: [
                    {
                        path: 'user',
                        select: 'username name profileImage'
                    },
                    {
                        path: 'replies.user',
                        select: 'username name profileImage'
                    }
                ]
            })
            .populate('likes')
            .sort({ createdAt: -1 });
        
        res.render("feed", { 
            posts, 
            user: currentUser, 
            isNewUser,
            suggestedUsers
        });
    } catch (error) {
        console.error("Error fetching feed:", error);
        res.status(500).send("Failed to load feed");
    }
});

app.post("/post/:postId/like", isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findById(req.params.postId);
        const user = await userModel.findOne({ email: req.user.email });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Check if the user ID is actually in the likes array
        const isLiked = post.likes.some(likeId => likeId.toString() === user._id.toString());

        if (isLiked) {
            // User has already liked the post, so unlike it
            post.likes = post.likes.filter(likeId => likeId.toString() !== user._id.toString());
            await post.save();
            return res.json({ likes: post.likes.length, isLiked: false });
        } else {
            // User hasn't liked the post, so add their like
            post.likes.push(user._id);
            await post.save();
            
            // Create notification for post like
            if (post.user.toString() !== user._id.toString()) {
                try {
                    const {
                        createLikeNotification
                    } = require('./utils/notifications');
                    
                    await createLikeNotification({
                        recipientId: post.user,
                        senderId: user._id,
                        senderName: user.name || 'Someone',
                        postId: post._id
                    });
                } catch (notifError) {
                    console.error('Error creating like notification:', notifError);
                    // Continue even if notification fails
                }
            }
            
            return res.json({ likes: post.likes.length, isLiked: true });
        }
    } catch (error) {
        console.error('Error processing like:', error);
        res.status(500).json({ error: "Error processing like" });
    }
});

// Unlike a post
app.post("/post/:postId/unlike", isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findById(req.params.postId);
        const user = await userModel.findOne({ email: req.user.email });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Check if the user has liked the post
        if (post.likes.includes(user._id)) {
            post.likes.pull(user._id);
            await post.save();
            res.json({ message: "Post unliked", likes: post.likes.length });
        } else {
            return res.status(400).json({ error: "Post not liked yet" });
        }
    } catch (error) {
        console.error('Error unliking post:', error);
        res.status(500).json({ error: "Error unliking post" });
    }
});

// Add profile image upload route
app.post('/upload-profile-pic', isLoggedIn, profileUpload.single('profilepic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        
        // Get cloudinary upload function
        const { uploadToCloudinary } = require('./config/cloudinary');
        
        console.log('Uploading profile picture to Cloudinary');
        
        // Upload to Cloudinary - pass the whole file object to handle all cases
        const result = await uploadToCloudinary(req.file, { 
            folder: 'jccbuzz/profiles' 
        });
        
        console.log('Profile picture uploaded to:', result.secure_url);
        
        // Update user profile with Cloudinary URL
        const user = await userModel.findOne({ email: req.user.email });
        user.profileImage = result.secure_url;
        await user.save();
        
        // Redirect back to edit profile page
        res.redirect('/edit-profile');
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).send('Error uploading profile picture');
    }
});

// Separate function to handle the actual upload processing
async function processUpload(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Get cloudinary upload function
        const { uploadToCloudinary } = require('./config/cloudinary');
        
        // Upload to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, { 
            folder: 'jccbuzz/profiles' 
        });
        
        // Update user profile with Cloudinary URL
        user.profileImage = result.secure_url;
        await user.save();
        
        res.redirect('/profile');
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).send("Error saving image to profile");
    }
}

// Add comment
app.post("/post/:postId/comment", isLoggedIn, async (req, res) => {
    try {
        const { content } = req.body;
        const post = await postModel.findById(req.params.postId);
        const user = await userModel.findOne({ email: req.user.email });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        const comment = await commentModel.create({
            content,
            user: user._id,
            post: post._id
        });

        // Add comment to post's comments array
        post.comments.push(comment._id);
        await post.save();

        // Populate user details for the response
        await comment.populate('user', 'name username profileImage');
        
        // Create notification for comment
        if (post.user.toString() !== user._id.toString()) {
            try {
                const {
                    createCommentNotification
                } = require('./utils/notifications');
                
                await createCommentNotification({
                    recipientId: post.user,
                    senderId: user._id,
                    senderName: user.name || 'Someone',
                    postId: post._id,
                    commentId: comment._id
                });
            } catch (notifError) {
                console.error('Error creating comment notification:', notifError);
                // Continue even if notification fails
            }
        }
                
        // Check for mentions in the comment
        const mentionRegex = /@(\w+)/g;
        const mentions = content.match(mentionRegex);
        
        if (mentions) {
            const usernames = mentions.map(mention => mention.substring(1));
            
            // Find mentioned users
            const mentionedUsers = await userModel.find({
                username: { $in: usernames }
            });
            
            // Create mention notifications
            for (const mentionedUser of mentionedUsers) {
                // Don't notify yourself or the post owner (who already gets a comment notification)
                if (mentionedUser._id.toString() !== user._id.toString() && 
                    mentionedUser._id.toString() !== post.user.toString()) {
                    try {
                        const {
                            createMentionNotification
                        } = require('./utils/notifications');
                        
                        await createMentionNotification({
                            recipientId: mentionedUser._id,
                            senderId: user._id,
                            senderName: user.name || 'Someone',
                            postId: post._id,
                            commentId: comment._id
                        });
                    } catch (notifError) {
                        console.error('Error creating mention notification:', notifError);
                        // Continue even if notification fails
                    }
                }
            }
        }

        // Emit socket event for real-time updates
        io.emit('newComment', {
            postId: post._id,
            comment: {
                _id: comment._id,
                content: comment.content,
                user: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage
                },
                createdAt: comment.createdAt
            }
        });

        res.json({
            success: true,
            comment: comment
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: "Error adding comment" });
    }
});

// Add reply to comment
app.post("/comment/:commentId/reply", isLoggedIn, async (req, res) => {
    try {
        const { content } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        const comment = await commentModel.findById(req.params.commentId);

        comment.replies.push({
            user: user._id,
            content,
            likes: []
        });

        await comment.save();
        await comment.populate('replies.user', 'name username profileImage');
        
        // Get the latest reply with its index
        const replyIndex = comment.replies.length - 1;
        const reply = comment.replies[replyIndex];
        reply.replyIndex = replyIndex; // Add index for the client to use
        
        // Create notification for reply
        if (comment.user.toString() !== user._id.toString()) {
            // Get the post for context
            const post = await postModel.findById(comment.post);
            try {
                const sender = await userModel.findById(user._id);
                const senderName = sender ? sender.name : 'Someone';
                
                const { createReplyNotification } = require('./utils/notifications');
                
                await createReplyNotification({
                    recipientId: comment.user,
                    senderId: user._id,
                    senderName: senderName,
                    postId: post._id,
                    commentId: comment._id
                });
            } catch (notifError) {
                console.error('Error creating reply notification:', notifError);
                // Continue even if notification fails
            }
        }
        
        // Check for mentions in the reply
        const mentionRegex = /@(\w+)/g;
        const mentions = content.match(mentionRegex);
        
        if (mentions) {
            const usernames = mentions.map(mention => mention.substring(1));
            
            // Find mentioned users and notify them
            const mentionedUsers = await userModel.find({
                username: { $in: usernames }
            });
            
            for (const mentionedUser of mentionedUsers) {
                // Don't notify yourself or the comment owner (who already gets a reply notification)
                if (mentionedUser._id.toString() !== user._id.toString() && 
                    mentionedUser._id.toString() !== comment.user.toString()) {
                    const post = await postModel.findById(comment.post);
                    const { createMentionNotification } = require('./utils/notifications');
                    
                    await createMentionNotification({
                        recipientId: mentionedUser._id,
                        senderId: user._id,
                        senderName: user.name || 'Someone',
                        postId: post._id,
                        commentId: comment._id
                    });
                }
            }
        }
        
        res.json(reply);
    } catch (error) {
        res.status(500).json({ error: "Error adding reply" });
    }
});

// Like/unlike comment
app.post("/comment/:commentId/like", isLoggedIn, async (req, res) => {
    try {
        const comment = await commentModel.findById(req.params.commentId);
        const user = await userModel.findOne({ email: req.user.email });

        const isLiked = comment.likes.includes(user._id);

        if (isLiked) {
            comment.likes = comment.likes.filter(id => id.toString() !== user._id.toString());
        } else {
            comment.likes.push(user._id);
            
            // Create notification for comment like
            if (comment.user.toString() !== user._id.toString()) {
                try {
                    const post = await postModel.findById(comment.post);
                    const {
                        createNotification
                    } = require('./utils/notifications');
                    
                    await createNotification({
                        recipient: comment.user,
                        sender: user._id,
                        type: 'comment_like',
                        title: 'Comment Liked',
                        message: `${user.name || 'Someone'} liked your comment`,
                        data: {
                            postId: post._id,
                            commentId: comment._id
                        }
                    });
                } catch (notifError) {
                    console.error('Error creating comment like notification:', notifError);
                    // Continue even if notification fails
                }
            }
        }

        await comment.save();
        res.json({ likes: comment.likes.length, isLiked: !isLiked });
    } catch (error) {
        res.status(500).json({ error: "Error processing like" });
    }
});

// Like/unlike reply
app.post("/comment/:commentId/reply/:replyIndex/like", isLoggedIn, async (req, res) => {
    try {
        const comment = await commentModel.findById(req.params.commentId);
        const user = await userModel.findOne({ email: req.user.email });
        const replyIndex = parseInt(req.params.replyIndex);

        if (!comment || !comment.replies || replyIndex >= comment.replies.length) {
            return res.status(404).json({ error: "Reply not found" });
        }

        const reply = comment.replies[replyIndex];
        const isLiked = reply.likes.some(id => id.toString() === user._id.toString());

        if (isLiked) {
            // Unlike the reply
            reply.likes = reply.likes.filter(id => id.toString() !== user._id.toString());
        } else {
            // Like the reply
            reply.likes.push(user._id);
            
            // Create notification for reply like
            if (reply.user.toString() !== user._id.toString()) {
                try {
                    const post = await postModel.findById(comment.post);
                    const {
                        createNotification
                    } = require('./utils/notifications');
                    
                    await createNotification({
                        recipient: reply.user,
                        sender: user._id,
                        type: 'reply_like',
                        title: 'Reply Liked',
                        message: `${user.name || 'Someone'} liked your reply`,
                        data: {
                            postId: post._id,
                            commentId: comment._id
                        }
                    });
                } catch (notifError) {
                    console.error('Error creating reply like notification:', notifError);
                    // Continue even if notification fails
                }
            }
        }

        await comment.save();
        res.json({ likes: reply.likes.length, isLiked: !isLiked });
    } catch (error) {
        console.error('Error liking reply:', error);
        res.status(500).json({ error: "Error processing like" });
    }
});

// View other user's profile
app.get("/user/:username", isLoggedIn, async (req, res) => {
    try {
        const profileUser = await userModel.findOne({ username: req.params.username })
            .populate({
                path: 'posts',
                options: { sort: { createdAt: -1 } }, // Sort posts by newest first
                populate: {
                    path: 'user',
                    select: 'username name profileImage'
                }
            })
            .populate('followers', 'username name profileImage')
            .populate('following', 'username name profileImage');

        if (!profileUser) {
            return res.status(404).send("User not found");
        }

        // Get current user by ID first, then by email if needed
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        }
        if (!currentUser && req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }

        if (!currentUser) {
            return res.redirect("/login");
        }

        // Populate current user's following to check follow status
        currentUser = await userModel.findById(currentUser._id)
            .populate('following', '_id');

        const isOwnProfile = profileUser._id.equals(currentUser._id);
        
        res.render("userProfile", { 
            profileUser, 
            user: currentUser,
            isOwnProfile 
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).send("Error loading profile");
    }
});

// Edit profile page
app.get("/edit-profile", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("editProfile", { user });
});

// Update profile
app.post("/update-profile", isLoggedIn, async (req, res) => {
    try {
        const { name, username, bio } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        
        user.name = name;
        user.username = username;
        user.bio = bio;
        // Removed isPrivate handling
        
        await user.save();
        res.redirect("/profile");
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send("Error updating profile");
    }
});

// Update theme preference
app.post("/update-theme", isLoggedIn, async (req, res) => {
    try {
        const { darkMode } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        
        user.darkMode = darkMode;
        await user.save();
        
        res.json({ success: true, darkMode: user.darkMode });
    } catch (error) {
        console.error('Error updating theme preference:', error);
        res.status(500).json({ success: false, error: "Failed to update theme preference" });
    }
});

// Remove profile picture
app.get("/remove-profile-pic", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Reset to default profile image
        user.profileImage = '/placeholder/image.png';
        await user.save();
        
        res.redirect("/edit-profile");
    } catch (error) {
        console.error('Error removing profile picture:', error);
        res.status(500).send("Error removing profile picture");
    }
});

// Get all chats for current user
app.get("/chats", isLoggedIn, async (req, res) => {
    try {
        const currentUser = await userModel.findOne({ email: req.user.email });
        const chats = await chatModel.find({
            participants: currentUser._id
        }).populate('participants', 'name username profileImage')
          .populate('messages.sender', 'name username profileImage')
          .sort({ lastMessage: -1 });

        res.render("chats", { user: currentUser, chats });
    } catch (error) {
        res.status(500).send("Error loading chats");
    }
});

// Get or create chat with specific user
app.get("/chat/:userId", isLoggedIn, async (req, res) => {
    try {
        const currentUser = await userModel.findOne({ email: req.user.email });
        const otherUser = await userModel.findById(req.params.userId);

        if (!otherUser) {
            return res.status(404).send("User not found");
        }

        let chat = await chatModel.findOne({
            participants: { $all: [currentUser._id, otherUser._id] }
        }).populate('participants', 'name username profileImage isOnline')
          .populate('messages.sender', 'name username profileImage')
          .populate({
              path: 'messages.sharedPost',
              populate: {
                  path: 'user',
                  select: 'name username profileImage'
              }
          });

        if (!chat) {
            chat = await chatModel.create({
                participants: [currentUser._id, otherUser._id],
                messages: []
            });
            await chat.populate('participants', 'name username profileImage isOnline');
        }

        res.render("chat", { 
            user: currentUser, 
            chat, 
            otherUser,
            messages: chat.messages || [] // Explicitly pass messages array
        });
    } catch (error) {
        console.error('Error loading chat:', error);
        res.status(500).send("Error loading chat");
    }
});

// Send a message with media
app.post("/chat/:chatId/media", isLoggedIn, async (req, res) => {
    try {
        uploadChatMedia(req, res, async function (err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            
            const { chatId } = req.params;
            const { content, receiverId } = req.body;
            
            const user = await userModel.findOne({ email: req.user.email });
            const chat = await chatModel.findById(chatId);
            
            if (!chat) {
                return res.status(404).json({ error: "Chat not found" });
            }
            
            // Get cloudinary upload function
            const { uploadToCloudinary } = require('./config/cloudinary');
            
            // Determine media type and handle upload
            let mediaType = 'none';
            let mediaUrl = null;
            
            if (req.file) {
                mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
                
                try {
                    // Upload file to Cloudinary
                    const result = await uploadToCloudinary(req.file, {
                        folder: 'jccbuzz/chat',
                        resource_type: 'auto' // Handle both images and videos
                    });
                    
                    mediaUrl = result.secure_url;
                    console.log(`Chat media uploaded to Cloudinary: ${mediaUrl}`);
                } catch (uploadError) {
                    console.error('Error uploading to Cloudinary:', uploadError);
                    return res.status(500).json({ error: "Error uploading media" });
                }
            }
            
            // Create message
            const message = {
                sender: user._id,
                content: content || '',
                mediaType,
                mediaUrl,
                read: false,
                timestamp: Date.now()
            };
            
            chat.messages.push(message);
            chat.lastMessage = Date.now();
            await chat.save();
            
            // Correctly populate the sender field using the full path
            await chat.populate('messages.sender', 'name username profileImage');
            
            // Get the newly added message
            const populatedMessage = chat.messages[chat.messages.length - 1];
            
            // Emit event to recipient
            io.to(receiverId).emit('newMessage', {
                chatId,
                message: populatedMessage
            });
            
            res.json(populatedMessage);
        });
    } catch (error) {
        console.error('Error sending media message:', error);
        res.status(500).json({ error: "Error sending media message" });
    }
});

// Upload story
app.post("/story", isLoggedIn, uploadStory.single('file'), async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        if (!req.file) {
            return res.status(400).json({ error: "No media file provided" });
        }

        console.log('Processing story upload');
        
        // Get cloudinary upload function
        const { uploadToCloudinary } = require('./config/cloudinary');
        
        // Process image to maintain mobile-like aspect ratio and optimize
        const processedBuffer = await sharp(req.file.buffer)
            .resize({
                width: 1080,
                height: 1920,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            })
            .jpeg({ quality: 85 })
            .toBuffer();
            
        console.log('Story image processed, uploading to Cloudinary');
        
        // Upload to Cloudinary
        const result = await uploadToCloudinary(processedBuffer, {
            folder: 'jccbuzz/stories'
        });
        
        console.log('Story uploaded to Cloudinary:', result.secure_url);

        // Parse text overlay and emojis from request
        const textOverlay = req.body.textOverlay ? JSON.parse(req.body.textOverlay) : null;
        const emojis = req.body.emojis ? JSON.parse(req.body.emojis) : [];

        const story = await storyModel.create({
            user: user._id,
            media: {
                url: result.secure_url,
                type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
            },
            textOverlay,
            emojis
        });

        await story.populate('user', 'username name profileImage');
        
        // Update user's hasActiveStory flag
        user.hasActiveStory = true;
        await user.save();

        // Send the complete story data in response
        res.status(200).json({ 
            message: "Story uploaded successfully",
            story: {
                ...story.toObject(),
                user: {
                    _id: user._id,
                    username: user.username,
                    name: user.name,
                    profileImage: user.profileImage
                }
            }
        });

        // Emit to all connected users
        io.emit('newStory', { 
            story: {
                ...story.toObject(),
                user: {
                    _id: user._id,
                    username: user.username,
                    name: user.name,
                    profileImage: user.profileImage
                }
            }
        });
    } catch (error) {
        console.error('Error uploading story:', error);
        res.status(500).json({ error: "Error uploading story" });
    }
});

// Get stories
app.get("/stories", isLoggedIn, async (req, res) => {
    try {
        const currentUser = await userModel.findOne({ email: req.user.email });
        
        // Get IDs of users the current user follows plus their own ID
        const followingIds = [...(currentUser.following || []), currentUser._id];
        
        console.log(`User ${currentUser._id} follows ${followingIds.length - 1} users`);
        
        // Find stories from the current user and users they follow that are less than 24 hours old
        const stories = await storyModel.find({
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            user: { $in: followingIds }
        }).populate('user', 'username name profileImage')
          .sort({ createdAt: -1 });
          
        console.log(`Found ${stories.length} stories from followed users`);

        res.json({ stories });
    } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(500).json({ error: "Error fetching stories" });
    }
});

// Delete story
app.delete("/story/:storyId", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId);

        if (!story || story.user.toString() !== user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Get Cloudinary functions
        const { getPublicIdFromUrl, deleteFromCloudinary } = require('./config/cloudinary');
        
        // Delete from Cloudinary if it's a Cloudinary URL
        if (story.media && story.media.url) {
            const publicId = getPublicIdFromUrl(story.media.url);
            if (publicId) {
                await deleteFromCloudinary(publicId);
                console.log(`Deleted story media from Cloudinary: ${publicId}`);
            }
        }

        await story.delete();
        res.json({ message: "Story deleted successfully" });
    } catch (error) {
        console.error('Error deleting story:', error);
        res.status(500).json({ error: "Error deleting story" });
    }
});

// Mark story as viewed
app.post("/story/:storyId/view", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId);

        if (!story.viewers.some(viewer => viewer.user.toString() === user._id.toString())) {
            story.viewers.push({ user: user._id });
            await story.save();
        }

        res.json({ message: "Story marked as viewed" });
    } catch (error) {
        res.status(500).json({ error: "Error marking story as viewed" });
    }
});

// Story reply route
app.post("/story/:storyId/reply", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId)
            .populate('user', 'username name profileImage');

        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }

        const message = req.body.message;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        // Create or get existing chat
        let chat = await chatModel.findOne({
            participants: { 
                $all: [user._id, story.user._id],
                $size: 2
            }
        });

        if (!chat) {
            chat = await chatModel.create({
                participants: [user._id, story.user._id],
                messages: []
            });
        }

        // Get timestamp information for the story
        const storyTime = new Date(story.createdAt);
        const now = new Date();
        const diffInHours = Math.floor((now - storyTime) / (1000 * 60 * 60));
        const timeText = diffInHours === 0 ? 'Just now' : `${diffInHours}h ago`;

        // Add story reply message with enhanced details
        const newMessage = {
            sender: user._id,
            content: message,
            isStoryReply: true,
            storyId: story._id,
            mediaType: 'image',
            mediaUrl: story.media.url,
            replyContext: {
                storyOwner: story.user._id,
                storyTimestamp: story.createdAt,
                timeText: timeText
            },
            read: false,
            createdAt: Date.now()
        };

        chat.messages.push(newMessage);
        chat.lastMessage = Date.now();
        await chat.save();

        // Populate the sender information
        await chat.populate('messages.sender', 'name username profileImage');
        
        // Get the newly created message with populated data
        const populatedMessage = chat.messages[chat.messages.length - 1];

        // Notify story owner through socket
        const storyOwnerSocketId = connectedUsers.get(story.user._id.toString());
        if (storyOwnerSocketId) {
            io.to(storyOwnerSocketId).emit('newMessage', {
                chatId: chat._id,
                message: populatedMessage,
                from: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage
                },
                isStoryReply: true,
                storyId: story._id,
                storyPreview: {
                    url: story.media.url,
                    type: story.media.type
                }
            });
            
            // Also send a special story reply notification
            io.to(storyOwnerSocketId).emit('storyReply', {
                from: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage
                },
                message: message,
                storyId: story._id,
                storyUrl: story.media.url,
                timestamp: new Date()
            });
        }

        // Create a chat notification for the story owner if not online
        if (!storyOwnerSocketId) {
            try {
                const { createNotification } = require('./utils/notifications');
                
                await createNotification({
                    recipient: story.user._id,
                    sender: user._id,
                    type: 'story_reply',
                    title: 'Story Reply',
                    message: `${user.name || user.username} replied to your story`,
                    data: { 
                        chatId: chat._id,
                        storyId: story._id,
                        message: message
                    }
                });
            } catch (error) {
                console.error('Error creating story reply notification:', error);
            }
        }

        res.json({ 
            message: "Reply sent successfully",
            chatId: chat._id 
        });
    } catch (error) {
        console.error('Error sending story reply:', error);
        res.status(500).json({ error: "Error sending reply" });
    }
});

// Story delete route
app.delete("/story/:storyId/delete", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId);

        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }

        // Check if user owns the story
        if (story.user.toString() !== user._id.toString()) {
            return res.status(403).json({ error: "You can only delete your own stories" });
        }

        // Delete the story
        await storyModel.findByIdAndDelete(req.params.storyId);

        // Optional: Find and update any chat messages that reference this story
        // This keeps the messages but marks them as associated with a deleted story
        await chatModel.updateMany(
            { "messages.storyId": req.params.storyId },
            { 
                $set: { 
                    "messages.$[elem].storyDeleted": true 
                } 
            },
            { 
                arrayFilters: [{ "elem.storyId": req.params.storyId }] 
            }
        );

        res.status(200).json({ message: "Story deleted successfully" });
    } catch (error) {
        console.error("Error deleting story:", error);
        res.status(500).json({ error: "Error deleting story" });
    }
});

// Story delete route
app.delete("/story/delete", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Find the user's active stories
        const stories = await storyModel.find({ 
            user: user._id,
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Stories from last 24 hours
        });
        
        if (stories.length === 0) {
            return res.status(404).json({ error: "No active stories found" });
        }
        
        // Delete all active stories for this user
        await storyModel.deleteMany({ 
            user: user._id,
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        // Update user hasActiveStory status
        await userModel.findByIdAndUpdate(user._id, { hasActiveStory: false });
        
        res.status(200).json({ message: "Story deleted successfully" });
    } catch (error) {
        console.error("Error deleting story:", error);
        res.status(500).json({ error: "Error deleting story" });
    }
});

// Add this after all your middleware setup
const connectedUsers = new Map(); // Store online users

// Change app.listen to server.listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Initialize Socket.IO after server is listening
    global.io = socketModule.initSocket(server);
    
    // Add the socket connection handler here after initialization
    if (global.io) {
        // Additional socket handlers for functionality not in socket/socket.js
        global.io.on('connection', (socket) => {
    let currentUserId = null;

    socket.on('authenticate', async (userData) => {
        // Extract userId - it could be a string or an object with userId property
        const userId = typeof userData === 'object' && userData.userId ? userData.userId : userData;
        
        currentUserId = userId;
        socket.userId = userId;
        connectedUsers.set(userId, socket.id);
        
        try {
            await userModel.findByIdAndUpdate(userId, { isOnline: true });
                    global.io.emit('userOnline', userId);
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    });

    socket.on('typing', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
                    global.io.to(receiverSocketId).emit('userTyping', {
                chatId: data.chatId,
                userId: socket.userId
            });
        }
    });

    socket.on('messageDeleted', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
                    global.io.to(receiverSocketId).emit('messageDeleted', {
                chatId: data.chatId,
                messageId: data.messageId
            });
        }
    });

    socket.on('messageReacted', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
                    global.io.to(receiverSocketId).emit('messageReacted', {
                chatId: data.chatId,
                messageId: data.messageId,
                reaction: data.reaction
            });
        }
    });

    socket.on('disconnect', async () => {
        if (currentUserId) {
            connectedUsers.delete(currentUserId);
            try {
                await userModel.findByIdAndUpdate(currentUserId, { isOnline: false });
                        global.io.emit('userOffline', currentUserId);
            } catch (error) {
                console.error('Error updating offline status:', error);
            }
        }
    });

    // Voice Call Signaling
    // When a user initiates a call
    socket.on('callUser', (data) => {
        const { userToCall, signalData, from, fromName } = data;
                global.io.to(userSocketIdMap[userToCall]).emit('incomingCall', {
            signal: signalData,
            from,
            fromName
        });
    });

    // When a user accepts a call
    socket.on('answerCall', (data) => {
        const { signal, to } = data;
                global.io.to(userSocketIdMap[to]).emit('callAccepted', signal);
    });

    // When a user rejects a call
    socket.on('rejectCall', (data) => {
        const { from, to } = data;
                global.io.to(userSocketIdMap[from]).emit('callRejected', { from: to });
    });

    // When a user ends a call
    socket.on('endCall', (data) => {
        const { to } = data;
                global.io.to(userSocketIdMap[to]).emit('callEnded');
    });

    // When user is unavailable for call
    socket.on('userBusy', (data) => {
        const { from } = data;
                global.io.to(userSocketIdMap[from]).emit('userBusy');
    });
});
    } else {
        console.error("Failed to initialize Socket.IO");
    }

    console.log('Socket.IO server initialized');
});

// Add a cleanup function to update hasActiveStory when stories expire
async function updateUserStoryStatus(userId) {
    const activeStories = await storyModel.find({
        user: userId,
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    await userModel.findByIdAndUpdate(userId, {
        hasActiveStory: activeStories.length > 0
    });
}

// Middleware to fetch unread messages count
async function fetchUnreadMessagesCount(req, res, next) {
    if (req.user) {
        try {
            const user = await userModel.findOne({ email: req.user.email });
            
            // Find all chats for this user
            const chats = await chatModel.find({
                participants: user._id
            }).populate({
                path: 'messages',
                match: { 
                    read: false,
                    sender: { $ne: user._id } // Only count messages not sent by the current user
                }
            });
            
            // Count all unread messages
            let unreadMessages = 0;
            chats.forEach(chat => {
                unreadMessages += chat.messages.length;
            });
            
            res.locals.unreadMessages = unreadMessages;
        } catch (error) {
            console.error('Error fetching unread messages count:', error);
            res.locals.unreadMessages = 0;
        }
    }
    next();
}

// Apply the middleware after isLoggedIn
app.use(fetchUnreadMessagesCount);

// Middleware to fetch follow requests count
async function fetchFollowRequestsCount(req, res, next) {
    try {
        if (req.isAuthenticated()) {
            // Find user
        let user;
        if (req.user._id) {
            user = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            user = await userModel.findOne({ email: req.user.email });
        }
        
        if (user && user.followRequests) {
            res.locals.followRequestsCount = user.followRequests.length;
        }
        }
        next();
    } catch (error) {
        console.error('Error fetching follow requests count:', error);
    next();
}
}
// Disabled follow requests feature
// app.use(fetchFollowRequestsCount);

// Send regular text message
app.post("/chat/:chatId/message", isLoggedIn, async (req, res) => {
    try {
        const { content, receiverId } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        const chat = await chatModel.findById(req.params.chatId);
        
        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }
        
        const newMessage = {
            sender: user._id,
            content,
            mediaType: 'none',
            read: false,
            createdAt: Date.now()
        };
        
        chat.messages.push(newMessage);
        chat.lastMessage = Date.now();
        await chat.save();
        
        // Populate the sender details
        await chat.populate('messages.sender', 'name username profileImage');
        
        // Get the newly added message
        const populatedMessage = chat.messages[chat.messages.length - 1];
        
        // Emit to receiver
        const receiverSocketId = connectedUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('newMessage', {
                chatId: chat._id,
                message: populatedMessage
            });
        }
        
        res.json(populatedMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: "Error sending message" });
    }
});

// Share post route
app.post('/post/:postId/share', isLoggedIn, async (req, res) => {
    try {
        const { username, message } = req.body;
        const postId = req.params.postId;
        
        // Find the sender (current user)
        const sender = await userModel.findOne({ email: req.user.email });
        
        // Find the receiver by username
        const receiver = await userModel.findOne({ username: username });
        
        if (!receiver) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Find the post and populate user details
        const post = await postModel.findById(postId).populate('user', 'name username profileImage');
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Find existing chat or create new one
        let chat = await chatModel.findOne({
            participants: {
                $all: [sender._id, receiver._id],
                $size: 2
            }
        });
        
        if (!chat) {
            chat = new chatModel({
                participants: [sender._id, receiver._id],
                messages: []
            });
        }
        
        // Create post preview
        const postPreview = {
            title: post.title,
            content: post.content,
            image: post.images && post.images.length > 0 ? post.images[0].url : null,
            postId: post._id
        };
        
        // Add the shared post message
        chat.messages.push({
            sender: sender._id,
            content: message || 'Shared a post with you',
            isPostShare: true,
            sharedPost: post._id,
            sharedPostPreview: postPreview
        });
        
        await chat.save();
        
        // Populate the sender details and shared post details for the response
        await chat.populate([
            { path: 'messages.sender', select: 'name username profileImage' },
            { path: 'messages.sharedPost', populate: { path: 'user', select: 'name username profileImage' } }
        ]);
        
        // Emit socket event to recipient if they're online
        const recipientSocketId = connectedUsers.get(receiver._id.toString());
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('newMessage', {
                chatId: chat._id,
                message: chat.messages[chat.messages.length - 1]
            });
        }
        
        res.json({
            success: true,
            message: 'Post shared successfully',
            chat: chat
        });
    } catch (error) {
        console.error('Error sharing post:', error);
        res.status(500).json({ error: 'An error occurred while sharing the post' });
    }
});

// Search route
app.get('/search', isLoggedIn, async (req, res) => {
    try {
        const query = req.query.q;
        const format = req.query.format; // Check if format=json is requested
        
        if (!query) {
            if (format === 'json') {
                return res.json({ users: [] });
            }
            return res.render('searchResults', { users: [], query: '' });
        }
        
        // Search for users by name or username
        const users = await userModel.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { username: { $regex: query, $options: 'i' } }
            ]
        });
        
        // If JSON format is requested, return JSON response
        if (format === 'json') {
            return res.json({ users });
        }
        
        // Otherwise render the template
        res.render('searchResults', { users, query });
    } catch (error) {
        console.error('Search error:', error);
        if (req.query.format === 'json') {
            return res.status(500).json({ error: 'An error occurred during search' });
        }
        res.status(500).send('An error occurred during search');
    }
});

// Add view post route
app.get("/post/:postId", isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findById(req.params.postId)
            .populate('user', 'name username profileImage')
            .populate({
                path: 'comments',
                populate: [
                    {
                        path: 'user',
                        select: 'name username profileImage'
                    },
                    {
                        path: 'replies.user',
                        select: 'name username profileImage'
                    }
                ]
            })
            .populate('likes');

        if (!post) {
            return res.status(404).send("Post not found");
        }

        const currentUser = await userModel.findOne({ email: req.user.email });
        res.render("singlePost", { post, user: currentUser });
    } catch (error) {
        console.error('Error loading post:', error);
        res.status(500).send("Error loading post");
    }
});

// Add message edit route
app.put("/message/:messageId/edit", isLoggedIn, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const user = await userModel.findOne({ email: req.user.email });

        // Find the chat containing this message
        const chat = await chatModel.findOne({
            "messages._id": messageId,
            "messages.sender": user._id
        });

        if (!chat) {
            return res.status(404).json({ error: "Message not found" });
        }

        // Update the message
        const message = chat.messages.id(messageId);
        message.content = content;
        message.isEdited = true;
        await chat.save();

        // Find the other participant to notify them
        const otherParticipant = chat.participants.find(p => p.toString() !== user._id.toString());
        const receiverSocketId = connectedUsers.get(otherParticipant.toString());
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('messageEdited', {
                chatId: chat._id,
                messageId,
                content,
                isEdited: true
            });
        }

        res.json({
            success: true,
            content: message.content,
            isEdited: true
        });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ error: "Error editing message" });
    }
});

// Add message delete route
app.delete("/message/:messageId/delete", isLoggedIn, async (req, res) => {
    try {
        const { messageId } = req.params;
        const user = await userModel.findOne({ email: req.user.email });

        // Find the chat containing this message
        const chat = await chatModel.findOne({
            "messages._id": messageId,
            "messages.sender": user._id
        });

        if (!chat) {
            return res.status(404).json({ error: "Message not found" });
        }

        // Remove the message
        chat.messages.pull({ _id: messageId });
        await chat.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: "Error deleting message" });
    }
});

// Update the message reaction route to correctly save reactions and handle errors
app.post("/message/:messageId/react", isLoggedIn, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;
        
        if (!messageId || messageId === 'null' || messageId === 'undefined') {
            return res.status(400).json({ error: "Invalid message ID" });
        }
        
        const user = await userModel.findOne({ email: req.user.email });

        // Find the chat containing this message
        const chat = await chatModel.findOne({
            "messages._id": messageId
        });

        if (!chat) {
            return res.status(404).json({ error: "Message not found" });
        }

        // Update the message with the reaction
        const message = chat.messages.id(messageId);
        
        if (!message) {
            return res.status(404).json({ error: "Message not found in chat" });
        }
        
        message.reaction = reaction;
        await chat.save();

        // Find the other participant to notify them
        const otherParticipant = chat.participants.find(p => !p.equals(user._id));
        if (otherParticipant) {
            const receiverSocketId = connectedUsers.get(otherParticipant.toString());
            
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('messageReacted', {
                    chatId: chat._id,
                    messageId,
                    reaction
                });
            }
        }

        res.json({
            success: true,
            reaction: message.reaction
        });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ error: "Error adding reaction" });
    }
});

// Add voice message route
app.post("/chat/:chatId/voice", isLoggedIn, async (req, res) => {
    try {
        uploadVoice(req, res, async function (err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            
            const { chatId } = req.params;
            const { receiverId } = req.body;
            
            const user = await userModel.findOne({ email: req.user.email });
            const chat = await chatModel.findById(chatId);
            
            if (!chat) {
                return res.status(404).json({ error: "Chat not found" });
            }
            
            // Get cloudinary upload function
            const { uploadToCloudinary } = require('./config/cloudinary');
            
            let mediaUrl = null;
            
            try {
                // Upload to Cloudinary
                const result = await uploadToCloudinary(req.file, {
                    folder: 'jccbuzz/voice',
                    resource_type: 'auto' // Handle audio files
                });
                
                mediaUrl = result.secure_url;
                console.log(`Voice message uploaded to Cloudinary: ${mediaUrl}`);
            } catch (uploadError) {
                console.error('Error uploading voice message to Cloudinary:', uploadError);
                return res.status(500).json({ error: "Error uploading voice message" });
            }
            
            // Create message
            const message = {
                sender: user._id,
                content: '', // No text content for voice messages
                mediaType: 'audio',
                mediaUrl: mediaUrl,
                read: false,
                createdAt: Date.now()
            };
            
            chat.messages.push(message);
            chat.lastMessage = Date.now();
            await chat.save();
            
            // Populate the sender details
            await chat.populate('messages.sender', 'name username profileImage');
            
            // Get the newly added message
            const populatedMessage = chat.messages[chat.messages.length - 1];
            
            // Emit to receiver
            const receiverSocketId = connectedUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('newMessage', {
                    chatId: chat._id,
                    message: populatedMessage
                });
            }
            
            res.json(populatedMessage);
        });
    } catch (error) {
        console.error('Error sending voice message:', error);
        res.status(500).json({ error: "Error sending voice message" });
    }
});

// Initialize the student database with the provided list
app.get("/admin/init-student-db", async (req, res) => {
    try {
        // This is the list of students from the provided JSON
        const students = [
            { "enrollment_number": "021323001", "contact_number": "+919971790378" },
            { "enrollment_number": "021323002", "contact_number": "+918800311464" },
            { "enrollment_number": "021323004", "contact_number": "+917681962797" },
            { "enrollment_number": "021323005", "contact_number": "+918595520738" },
            { "enrollment_number": "021323006", "contact_number": "+918882194741" },
            { "enrollment_number": "021323007", "contact_number": "+918750753183" },
            { "enrollment_number": "021323008", "contact_number": "+918700574741" },
            { "enrollment_number": "021323009", "contact_number": "+918178822096" },
            { "enrollment_number": "021323010", "contact_number": "+919319981411" },
            { "enrollment_number": "021323011", "contact_number": "+919990000968" },
            { "enrollment_number": "021323012", "contact_number": "+918076787466" },
            { "enrollment_number": "021323013", "contact_number": "+918130380530" },
            { "enrollment_number": "021323014", "contact_number": "+919818597919" },
            { "enrollment_number": "021323015", "contact_number": "+919812713690" },
            { "enrollment_number": "021323016", "contact_number": "+919667101166" },
            { "enrollment_number": "021323017", "contact_number": "+918860145650" },
            { "enrollment_number": "021323018", "contact_number": "+918447540355" },
            { "enrollment_number": "021323019", "contact_number": "+917835823519" },
            { "enrollment_number": "021323020", "contact_number": "+918287941446" },
            { "enrollment_number": "021323022", "contact_number": "+917048960372" },
            { "enrollment_number": "021323023", "contact_number": "+919205858598" },
            { "enrollment_number": "021323024", "contact_number": "+917011455905" },
            { "enrollment_number": "021323025", "contact_number": "+918766362063" },
            { "enrollment_number": "021323026", "contact_number": "+918373904766" },
            { "enrollment_number": "021323027", "contact_number": "+917428036375" },
            { "enrollment_number": "021323028", "contact_number": "+919870367909" },
            { "enrollment_number": "021323029", "contact_number": "+919289649402" },
            { "enrollment_number": "021323030", "contact_number": "+919315269874" },
            { "enrollment_number": "021323031", "contact_number": "+919501695765" },
            { "enrollment_number": "021323032", "contact_number": "+917827360413" },
            { "enrollment_number": "021323034", "contact_number": "+919625538977" },
            { "enrollment_number": "021323035", "contact_number": "+918882045806" },
            { "enrollment_number": "021323036", "contact_number": "+918800244384" },
            { "enrollment_number": "021323037", "contact_number": "+918076999627" },
            { "enrollment_number": "021323038", "contact_number": "+918700696282" },
            { "enrollment_number": "021323039", "contact_number": "+918383978660" },
            { "enrollment_number": "021323040", "contact_number": "+918810560083" },
            { "enrollment_number": "021723002", "contact_number": "+918017869250" },
            { "enrollment_number": "021723003", "contact_number": "+918510005663" },
            { "enrollment_number": "021723005", "contact_number": "+918168848171" },
            { "enrollment_number": "021723006", "contact_number": "+919050651722" },
            { "enrollment_number": "021723007", "contact_number": "+918595775758" },
            { "enrollment_number": "021723008", "contact_number": "+919310285981" }
        ];
        
        // Clear existing data
        await StudentVerification.deleteMany({});
        
        // Insert new data
        await StudentVerification.insertMany(students);
        
        res.json({ success: true, message: "Student database initialized with 44 records" });
    } catch (error) {
        console.error("Error initializing student database:", error);
        res.status(500).json({ success: false, error: "Failed to initialize student database" });
    }
});

// Generate a random 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP using Twilio instead of Fast2SMS
async function sendOTP(phoneNumber, otp) {
    try {
        // Log attempt
        console.log(`Attempting to send OTP ${otp} to ${phoneNumber}`);
        
        // Check for required Twilio credentials
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        
        if (!accountSid || !authToken || !twilioPhone) {
            throw new Error("Twilio credentials are not properly configured");
        }
        
        // Initialize Twilio client
        const twilio = require('twilio')(accountSid, authToken);
        
        // Format the recipient phone number to include the country code
        // Assuming Indian numbers (+91)
        const formattedPhone = phoneNumber.startsWith('+') 
            ? phoneNumber 
            : `+91${phoneNumber}`;
        
        // Prepare the message
        const message = `Your verification code for JCCbuzz is: ${otp}. Valid for 2 minutes.`;
        
        // Send the SMS
        const response = await twilio.messages.create({
            body: message,
            from: twilioPhone,
            to: formattedPhone
        });
        
        console.log("Twilio message sent with SID:", response.sid);
        return true;
    } catch (error) {
        console.error("Failed to send SMS via Twilio:", error.message);
        
        // For development - print clearer debugging info
        if (process.env.NODE_ENV !== 'production') {
            console.log("=========== TWILIO SMS TROUBLESHOOTING ===========");
            console.log("1. Check your Twilio credentials at https://console.twilio.com");
            console.log("2. Verify your Twilio account has sufficient funds");
            console.log("3. Make sure the phone number is correctly formatted");
            console.log("4. For international numbers, ensure country code is included");
            console.log("5. Check that your Twilio phone number can send SMS");
            console.log("==================================================");
            
            // In development, still return true for testing
            console.log("DEVELOPMENT MODE: Using console OTP:", otp);
            return true;
        }
        
        return false;
    }
}

// Request OTP endpoint
app.post("/verify/request-otp", async (req, res) => {
    try {
        const { enrollment_number } = req.body;
        
        if (!enrollment_number) {
            return res.status(400).json({ error: "Enrollment number is required" });
        }
        
        
        console.log("Requesting OTP for enrollment number:", enrollment_number);
        
        // Check if enrollment number exists in the database
        const student = await StudentVerification.findOne({ enrollment_number });
        
        if (!student) {
            console.log("Invalid enrollment number:", enrollment_number);
            return res.status(404).json({ error: "Invalid enrollment number. Only university students can register." });
        }
        
        console.log("Found student record for enrollment number:", enrollment_number);
        
        // Check if a user with this enrollment number already exists
        const existingUser = await userModel.findOne({ enrollment_number });
        if (existingUser) {
            console.log("Enrollment number already registered:", enrollment_number);
            return res.status(400).json({ error: "This enrollment number is already registered. Please login instead." });
        }
        
        // Generate a new OTP
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 2); // OTP expires in 2 minutes
        
        console.log("Generated OTP for enrollment number:", enrollment_number, "OTP:", otp);
        console.log("=====================================================");
        console.log(`OTP ${otp} generated for ${student.name} (${student.email})`);
        console.log("This OTP will expire at:", expiresAt);
        console.log("=====================================================");
        
        // Try to send OTP to the student's email
        try {
            // Ensure student record has email and name
            if (!student.email) {
                return res.status(400).json({ 
                    error: "Student email not found. Please contact support." 
                });
            }
            
            if (!student.name) {
                return res.status(400).json({ 
                    error: "Student name not found. Please contact support." 
                });
            }
            
            // Send OTP email
            const sent = await sendOTPEmail(student.email, otp, student.name);
            
            if (!sent) {
                console.error("Failed to send OTP to email:", student.email);
                
                // Try SMS as fallback if phone number exists
                if (student.contact_number) {
                    console.log("Attempting SMS fallback to:", student.contact_number);
                    const smsSent = await sendOTP(student.contact_number, otp);
                    
                    if (smsSent) {
                        console.log("Successfully sent OTP via SMS to:", student.contact_number);
                        // Update student record with OTP
                        student.otp = {
                            code: otp,
                            expires_at: expiresAt
                        };
                        await student.save();
                        
                        // In development, return the OTP for testing
                        const devOtpInfo = process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {};
                        
                        return res.json({ 
                            success: true, 
                            message: "OTP sent successfully via SMS",
                            expires_at: expiresAt,
                            student_phone: student.contact_number,
                            ...devOtpInfo
                        });
                    }
                }
                
                // Always show OTP in development mode if both email and SMS fail
                if (process.env.NODE_ENV !== 'production') {
                    return res.status(200).json({ 
                        success: true, 
                        message: "Development mode: OTP saved but email and SMS failed",
                        dev_otp: otp,
                        expires_at: expiresAt,
                        student_email: student.email,
                        student_phone: student.contact_number || "No phone number"
                    });
                } else {
                    return res.status(500).json({ 
                        error: "Failed to send OTP. Please try again later or contact support." 
                    });
                }
            }
            
            // Update student record with OTP
            student.otp = {
                code: otp,
                expires_at: expiresAt
            };
            await student.save();
            
            // In development, return the OTP for testing
            const devOtpInfo = process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {};
            
            return res.json({ 
                success: true, 
                message: "OTP sent successfully",
                expires_at: expiresAt,
                student_email: student.email,
                ...devOtpInfo
            });
        } catch (emailError) {
            console.error("Error sending OTP to email:", student.email, emailError);
            
            // In development, allow proceeding even if email fails
            if (process.env.NODE_ENV !== 'production') {
                // Save OTP anyway for testing
                student.otp = {
                    code: otp,
                    expires_at: expiresAt
                };
                await student.save();
                
                return res.json({ 
                    success: true, 
                    message: "Development mode: OTP saved but not sent",
                    expires_at: expiresAt,
                    student_email: student.email,
                    dev_otp: otp,
                    warning: "Email sending failed but proceeding in development mode"
                });
            }
            
            return res.status(500).json({ 
                error: "Failed to send OTP. Please try again later or contact support." 
            });
        }
    } catch (error) {
        console.error("Error in request-otp endpoint:", error);
        
        // Provide detailed error in development, generic error in production
        if (process.env.NODE_ENV !== 'production') {
            return res.status(500).json({ 
                error: "Server error. Please try again.",
                details: error.message,
                stack: error.stack 
            });
        }
        
        return res.status(500).json({ 
            error: "Server error. Please try again." 
        });
    }
});

// Verify OTP endpoint
app.post("/verify/verify-otp", async (req, res) => {
    try {
        const { enrollment_number, otp } = req.body;
        
        if (!enrollment_number || !otp) {
            return res.status(400).json({ error: "Enrollment number and OTP are required" });
        }
        
        // Find the student record
        const student = await StudentVerification.findOne({ enrollment_number });
        
        if (!student) {
            return res.status(404).json({ error: "Invalid enrollment number" });
        }
        
        // Check if OTP exists and is valid
        if (!student.otp || !student.otp.code) {
            return res.status(400).json({ error: "No OTP requested. Please request a new OTP." });
        }
        
        // Check if OTP has expired
        if (new Date() > new Date(student.otp.expires_at)) {
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }
        
        // Verify OTP
        if (student.otp.code !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please try again." });
        }
        
        // Mark student as verified
        student.is_verified = true;
        student.otp = null; // Clear OTP after successful verification
        await student.save();
        
        return res.json({ 
            success: true, 
            message: "OTP verified successfully",
            student: {
                name: student.name,
                email: student.email,
                enrollment_number: student.enrollment_number
            }
        });
        
    } catch (error) {
        console.error("Error in verify-otp endpoint:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

// Test endpoint for SMS sending (development only)
app.get("/admin/test-sms", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: "This endpoint is only available in development mode" });
    }
    
    try {
        const testPhone = req.query.phone || "8700574741"; // Default to a test number
        const testOTP = "123456";
        
        console.log("Testing SMS functionality with phone:", testPhone);
        
        // Check if Twilio API key is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
            return res.status(500).json({ 
                error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER not configured", 
                instructions: "Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your .env file" 
            });
        }
        
        // Try sending the test SMS
        const sent = await sendOTP(testPhone, testOTP);
        
        if (sent) {
            return res.json({ 
                success: true, 
                message: "Test SMS sent successfully",
                phone: testPhone,
                otp: testOTP
            });
        } else {
            return res.status(500).json({ 
                error: "Failed to send test SMS", 
                phone: testPhone
            });
        }
    } catch (error) {
        console.error("Error in test-sms endpoint:", error);
        return res.status(500).json({
            error: "Server error",
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// SMS Test Page - Useful for debugging SMS issues
app.get('/admin/sms-test', isLoggedIn, (req, res) => {
    // Check if Twilio credentials are configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    
    let apiKeyStatus = 'Not configured';
    if (accountSid) {
        // Mask the key for security
        apiKeyStatus = 'Configured: ' + accountSid.substring(0, 5) + '...' + accountSid.substring(accountSid.length - 5);
    }
    
    res.render('test-sms', {
        defaultPhone: req.user?.phone || process.env.MY_PHONE || req.query.phone || '+919971790378',
        defaultMessage: 'This is a test message from JCCbuzz.',
        apiKeyStatus: apiKeyStatus,
        twilioPhone: twilioPhone || 'Not configured'
    });
});

// SMS Test API Endpoint
app.post('/admin/send-test-sms', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, error: 'This endpoint is only available in development mode' });
    }
    
    try {
        const { phone, message, use_otp } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }
        
        let result;
        if (use_otp) {
            // Generate an OTP and send it
            const otp = generateOTP();
            const sent = await sendOTP(phone, otp);
            
            result = {
                success: sent,
                message: sent ? 'OTP sent successfully' : 'Failed to send OTP',
                phone,
                otp,
                timestamp: new Date().toISOString(),
                use_otp: true
            };
        } else {
            // Send a custom message
            if (!message) {
                return res.status(400).json({ success: false, error: 'Message is required when not sending OTP' });
            }
            
            // Send a direct message using Twilio
            try {
                const apiKey = process.env.TWILIO_ACCOUNT_SID;
                if (!apiKey) {
                    throw new Error('Twilio API key not configured');
                }
                
                const twilio = require('twilio')(apiKey, process.env.TWILIO_AUTH_TOKEN);
                
                const response = await twilio.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phone
                });
                
                console.log('Twilio direct message response:', JSON.stringify(response));
                
                result = {
                    success: response && response.sid,
                    message: response && response.sid ? 'Message sent successfully' : 'Failed to send message',
                    phone,
                    api_response: response,
                    timestamp: new Date().toISOString(),
                    use_otp: false
                };
            } catch (error) {
                console.error('Error sending direct message:', error);
                result = {
                    success: false,
                    error: error.message,
                    phone,
                    timestamp: new Date().toISOString(),
                    use_otp: false
                };
            }
        }
        
        return res.json(result);
    } catch (error) {
        console.error('Error in send-test-sms endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Follow/Unfollow route
app.post('/user/:userId/follow', isLoggedIn, async (req, res) => {
    try {
        // First get both users with their current followers/following lists
        const userToFollow = await userModel.findById(req.params.userId);
        
        // Get current user by ID first, then by email if needed
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        }
        if (!currentUser && req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }

        if (!userToFollow || !currentUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if already following - use stringified IDs for more reliable comparison
        const isFollowing = currentUser.following.some(id => id.toString() === userToFollow._id.toString());

        if (isFollowing) {
            // Unfollow
            await userModel.findByIdAndUpdate(currentUser._id, {
                $pull: { following: userToFollow._id }
            });
            await userModel.findByIdAndUpdate(userToFollow._id, {
                $pull: { followers: currentUser._id }
            });
            
            return res.json({
                success: true,
                following: false,
                followRequested: false,
                followers: userToFollow.followers.length - 1
            });
        } else {
            // Check if the user has already requested to follow
            const hasRequestedFollow = userToFollow.followRequests && 
                userToFollow.followRequests.some(request => 
                    request.user && request.user.toString() === currentUser._id.toString()
                );
            
            if (hasRequestedFollow) {
                return res.json({
                    success: true,
                    following: false,
                    followRequested: true,
                    followers: userToFollow.followers.length
                });
            }
            
            // If account is private, add a follow request instead of following directly
            if (userToFollow.isPrivate) {
                // Check if the request already exists
                const alreadyRequested = userToFollow.followRequests && 
                    userToFollow.followRequests.some(req => 
                        req.user && req.user.toString() === currentUser._id.toString()
                    );
                
                if (!alreadyRequested) {
                    // Add follow request
                    await userModel.findByIdAndUpdate(userToFollow._id, {
                        $push: { 
                            followRequests: {
                                user: currentUser._id,
                                createdAt: new Date()
                            }
                        }
                    });
                    
                    // Create notification for follow request
                    const { createFollowRequestNotification } = require('./utils/notifications');
                    await createFollowRequestNotification({
                        recipientId: userToFollow._id,
                        senderId: currentUser._id,
                        senderName: currentUser.name || currentUser.username || 'Someone'
                    });
                }
                
                return res.json({
                    success: true,
                    following: false,
                    followRequested: true,
                    followers: userToFollow.followers.length
                });
            } else {
                // Public account - follow directly
                await userModel.findByIdAndUpdate(currentUser._id, {
                    $addToSet: { following: userToFollow._id }
                });
                await userModel.findByIdAndUpdate(userToFollow._id, {
                    $addToSet: { followers: currentUser._id }
                });
                
                // Create notification for new follower
                const { createFollowNotification } = require('./utils/notifications');
                await createFollowNotification({
                    recipientId: userToFollow._id,
                    senderId: currentUser._id,
                    senderName: currentUser.name || currentUser.username || 'Someone'
                });
                
                // Get updated follower count
                const updatedUser = await userModel.findById(userToFollow._id);
                
                return res.json({
                    success: true,
                    following: true,
                    followRequested: false,
                    followers: updatedUser.followers.length
                });
            }
        }
    } catch (error) {
        console.error('Error following/unfollowing user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user's followers
app.get('/user/:userId/followers', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.params.userId)
            .populate('followers', 'name username profileImage');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            followers: user.followers
        });
    } catch (error) {
        console.error('Get followers error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get user's following
app.get('/user/:userId/following', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.params.userId)
            .populate('following', 'name username profileImage');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            following: user.following
        });
    } catch (error) {
        console.error('Get following error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Modify follow route to include notification
app.post("/user/:username/follow", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const userToFollow = await userModel.findOne({ username: req.params.username });

        if (!userToFollow) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if already following
        const isFollowing = user.following.some(id => id.toString() === userToFollow._id.toString());

        if (isFollowing) {
            // Unfollow
            await userModel.findByIdAndUpdate(user._id, {
                $pull: { following: userToFollow._id }
            });
            await userModel.findByIdAndUpdate(userToFollow._id, {
                $pull: { followers: user._id }
            });
        } else {
            // Always directly follow (no private account checks)
                await userModel.findByIdAndUpdate(user._id, {
                    $addToSet: { following: userToFollow._id }
                });
                await userModel.findByIdAndUpdate(userToFollow._id, {
                    $addToSet: { followers: user._id }
                });
                
                // Create notification for new follower
                const { createFollowNotification } = require('./utils/notifications');
                await createFollowNotification({
                    recipientId: userToFollow._id,
                    senderId: user._id,
                    senderName: user.name || user.username || 'Someone'
                });
        }

        // Get updated follower count
        const updatedUser = await userModel.findById(userToFollow._id)
            .populate('followers')
            .populate('following');

        res.json({
            success: true,
            isFollowing: !isFollowing,
            followersCount: updatedUser.followers.length
        });
    } catch (error) {
        console.error('Error following/unfollowing user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API endpoints for notifications
app.get("/api/notifications", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ recipient: user._id })
            .sort({ createdAt: -1 })
            .limit(limit);
        
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: "Error fetching notifications" });
    }
});

app.post("/api/notifications/:id/read", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        const notification = await notificationModel.findOneAndUpdate(
            { _id: req.params.id, recipient: user._id },
            { read: true },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }
        
        // Get updated unread count
        const unreadCount = await notificationModel.countDocuments({
            recipient: user._id,
            read: false
        });
        
        res.json({ success: true, unreadCount });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: "Error marking notification as read" });
    }
});

app.post("/api/notifications/mark-all-read", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        await notificationModel.updateMany(
            { recipient: user._id, read: false },
            { read: true }
        );
        
        res.json({ success: true, unreadCount: 0 });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: "Error marking all notifications as read" });
    }
});

// Notifications page route
app.get("/notifications", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        let notifications = await notificationModel.find({ recipient: user._id })
            .sort({ createdAt: -1 });
        
        res.render('notifications', {
            user,
            notifications,
            title: 'Notifications',
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error rendering notifications page:', error);
        res.redirect('/');
    }
});

// Add this after the story view route
app.post("/story/:storyId/view", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId);

        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }

        // Check if user has already viewed the story
        const hasViewed = story.viewers.some(viewer => viewer.user.toString() === user._id.toString());
        
        if (!hasViewed) {
            // Add viewer
            story.viewers.push({
                user: user._id,
                viewedAt: Date.now()
            });
            
            // Update viewer count
            story.viewerCount = story.viewers.length;
            await story.save();

            // Emit socket event to story owner
            const storyOwnerSocketId = connectedUsers.get(story.user.toString());
            if (storyOwnerSocketId) {
                io.to(storyOwnerSocketId).emit('storyViewed', {
                    storyId: story._id,
                    viewerCount: story.viewerCount,
                    viewer: {
                        _id: user._id,
                        name: user.name,
                        username: user.username,
                        profileImage: user.profileImage
                    }
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking story as viewed:', error);
        res.status(500).json({ error: "Error marking story as viewed" });
    }
});

// Add this route to get story viewers
app.get("/story/:storyId/viewers", isLoggedIn, async (req, res) => {
    try {
        // Get current user by email first
        const currentUser = await userModel.findOne({ email: req.user.email });
        if (!currentUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const story = await storyModel.findById(req.params.storyId)
            .populate({
                path: 'viewers.user',
                select: 'name username profileImage',
                model: 'User'
            });

        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }

        // Only allow story owner to view the viewers list
        if (story.user.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: "Not authorized to view story viewers" });
        }

        // Filter out any viewers with invalid user data
        const viewers = story.viewers
            .filter(viewer => viewer.user) // Only include viewers with valid user data
            .map(viewer => ({
                _id: viewer.user._id,
                name: viewer.user.name || viewer.user.username,
                username: viewer.user.username,
                profileImage: viewer.user.profileImage || '/images/default-profile.png',
                viewedAt: viewer.viewedAt
            }));

        res.json({ viewers });
    } catch (error) {
        console.error('Error getting story viewers:', error);
        res.status(500).json({ error: "Error getting story viewers" });
    }
});

// Debug endpoint for notifications - only available in development
app.get("/api/debug/notifications", isLoggedIn, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Debug endpoints are not available in production' });
    }
    
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Get total count of notifications
        const totalCount = await notificationModel.countDocuments({ recipient: user._id });
        
        // Get count of notifications with missing sender
        const missingSenderCount = await notificationModel.countDocuments({ 
            recipient: user._id,
            sender: { $eq: null }
        });
        
        // Get count by notification type
        const typeCounts = await notificationModel.aggregate([
            { $match: { recipient: user._id } },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        
        // Get 5 most recent notifications with full details for debugging
        const recentNotifications = await notificationModel.find({ recipient: user._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('sender', 'name username profileImage')
            .populate('post')
            .populate('comment')
            .populate('story');
        
        // Create a test notification if requested
        if (req.query.createTest === 'true') {
            const testNotification = await createNotification(
                user._id,
                user._id, // Use self for test, will be filtered out
                'test',
                null,
                null,
                null
            );
            
            return res.json({
                status: 'Test notification attempted',
                result: testNotification ? 'success' : 'failed',
                totalCount,
                missingSenderCount,
                typeCounts,
                recentNotifications
            });
        }
        
        res.json({
            totalCount,
            missingSenderCount,
            typeCounts,
            recentNotifications
        });
    } catch (error) {
        console.error('Error in debug notifications endpoint:', error);
        res.status(500).json({ error: 'Error debugging notifications', details: error.message });
    }
});

// Endpoint to generate test notifications (only in development)
app.get("/api/debug/generate-test-notifications", isLoggedIn, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Debug endpoints are not available in production' });
    }
    
    try {
        const currentUser = await userModel.findOne({ email: req.user.email });
        
        // Find another user to use as sender for test notifications
        const otherUser = await userModel.findOne({ 
            _id: { $ne: currentUser._id },
            isOnline: { $ne: null } // Just to find any valid user
        });
        
        if (!otherUser) {
            return res.status(404).json({ 
                error: 'No other users found for generating test notifications',
                suggestion: 'Create another user account to test notifications'
            });
        }
        
        // Find a post to use for test notifications
        const somePost = await postModel.findOne();
        
        // Results of notification creation
        const results = {};
        
        // Create one notification of each type
        const notificationTypes = ['like', 'comment', 'follow', 'new_post'];
        
        for (const type of notificationTypes) {
            try {
                const notification = await createNotification(
                    currentUser._id,
                    otherUser._id,
                    type,
                    type !== 'follow' ? somePost?._id : null,
                    null,
                    null
                );
                
                results[type] = notification ? 'success' : 'failed';
            } catch (error) {
                console.error(`Error creating ${type} notification:`, error);
                results[type] = `error: ${error.message}`;
            }
        }
        
        res.json({
            message: 'Test notifications generation attempted',
            results,
            sender: {
                id: otherUser._id,
                name: otherUser.name,
                username: otherUser.username
            },
            post: somePost ? {
                id: somePost._id,
                title: somePost.title
            } : 'No posts found'
        });
    } catch (error) {
        console.error('Error generating test notifications:', error);
        res.status(500).json({ error: 'Error generating test notifications', details: error.message });
    }
});

// Follow Requests Page
app.get("/follow-requests", isLoggedIn, async (req, res) => {
    // Redirect to profile page - follow requests feature is disabled
    res.redirect("/profile");
});

// Accept follow request
app.post("/follow-request/:userId/accept", isLoggedIn, async (req, res) => {
    try {
        const requestUserId = req.params.userId;
        
        // Find current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }
        
        if (!currentUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if request exists
        const requestExists = currentUser.followRequests.some(
            request => request.user.toString() === requestUserId
        );
        
        if (!requestExists) {
            return res.status(404).json({ error: "Follow request not found" });
        }
        
        // Find requesting user
        const requestingUser = await userModel.findById(requestUserId);
        if (!requestingUser) {
            return res.status(404).json({ error: "Requesting user not found" });
        }
        
        // Update current user's followers list
        if (!currentUser.followers.includes(requestUserId)) {
            currentUser.followers.push(requestUserId);
        }
        
        // Update requesting user's following list
        if (!requestingUser.following.includes(currentUser._id)) {
            requestingUser.following.push(currentUser._id);
        }
        
        // Remove from follow requests
        currentUser.followRequests = currentUser.followRequests.filter(
            request => request.user.toString() !== requestUserId
        );
        
        // Save both users
        await Promise.all([
            currentUser.save(),
            requestingUser.save()
        ]);
        
        // Create notification for the user whose request was accepted
        await createNotification(
            requestUserId,
            currentUser._id,
            'followAccepted'
        );
        
        // Return success response
        return res.json({ 
            success: true, 
            message: "Follow request accepted",
            acceptedBy: {
                username: currentUser.username,
                name: currentUser.name,
                id: currentUser._id
            }
        });
    } catch (error) {
        console.error("Error accepting follow request:", error);
        return res.status(500).json({ error: "Server error" });
    }
});

// Reject follow request
app.post("/follow-request/:userId/reject", isLoggedIn, async (req, res) => {
    try {
        const requestUserId = req.params.userId;
        
        // Find current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }
        
        if (!currentUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if request exists
        const requestExists = currentUser.followRequests.some(
            request => request.user.toString() === requestUserId
        );
        
        if (!requestExists) {
            return res.status(404).json({ error: "Follow request not found" });
        }
        
        // Remove from follow requests
        currentUser.followRequests = currentUser.followRequests.filter(
            request => request.user.toString() !== requestUserId
        );
        
        await currentUser.save();
        
        return res.json({ 
            success: true, 
            message: "Follow request rejected" 
        });
    } catch (error) {
        console.error("Error rejecting follow request:", error);
        return res.status(500).json({ error: "Server error" });
    }
});

// API endpoint to check follow status
app.get("/api/follow-status/:userId", isLoggedIn, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }
        
        if (!currentUser) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        // Get target user
        const targetUser = await userModel.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }
        
        // Check if current user is following target user
        const isFollowing = currentUser.following && 
                            currentUser.following.some(id => id.toString() === userId);
                            
        // Check if there's a pending follow request
        const hasRequestedFollow = targetUser.followRequests && 
                                   targetUser.followRequests.some(req => 
                                        req.user && req.user.toString() === currentUser._id.toString()
                                   );
        
        res.json({
            following: isFollowing,
            followRequested: hasRequestedFollow,
            targetUserIsPrivate: targetUser.isPrivate
        });
    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get saved posts route
app.get('/saved-posts', isLoggedIn, async (req, res) => {
    try {
        console.log('User data from request:', req.user);
        
        // First try to find user by ID
        let user;
        if (req.user._id) {
            user = await userModel.findById(req.user._id);
        }
        
        // If no user found by ID, try to find by email
        if (!user && req.user.email) {
            user = await userModel.findOne({ email: req.user.email });
        }
        
        if (!user) {
            console.error('User not found in saved-posts route');
            return res.redirect('/login');
        }
        
        // Populate the savedPosts to get their details
        user = await userModel.findById(user._id).populate({
            path: 'savedPosts',
            populate: [
                {
                    path: 'user',
                    select: 'name username profileImage'
                },
                {
                    path: 'likes'
                },
                {
                    path: 'comments',
                    populate: {
                        path: 'user',
                        select: 'name username profileImage'
                    }
                }
            ]
        });
        
        res.render('savedPosts', { 
            savedPosts: user.savedPosts || [],
            user: user
        });
    } catch (error) {
        console.error('Error retrieving saved posts:', error);
        res.status(500).send('Server error');
    }
});

// Save/unsave post route
app.post("/post/:postId/save", isLoggedIn, async (req, res) => {
    try {
        const postId = req.params.postId;
        
        // Find the post
        const post = await postModel.findById(postId);
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        
        // Get current user
        let user;
        if (req.user._id) {
            user = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            user = await userModel.findOne({ email: req.user.email });
        }
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if post is already saved
        const isSaved = user.savedPosts && user.savedPosts.some(id => id.toString() === postId);
        
        if (isSaved) {
            // Remove post from saved posts
            user.savedPosts = user.savedPosts.filter(id => id.toString() !== postId);
            await user.save();
            res.json({ message: "Post unsaved", saved: false });
        } else {
            // Add post to saved posts
            if (!user.savedPosts) {
                user.savedPosts = [];
            }
            user.savedPosts.push(postId);
            await user.save();
            res.json({ message: "Post saved", saved: true });
        }
    } catch (error) {
        console.error('Error saving/unsaving post:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// API endpoint to check if a user is following another user
app.get("/api/follow-status/:userId", isLoggedIn, async (req, res) => {
    try {
        const profileUserId = req.params.userId;
        
        // Get current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }
        
        if (!currentUser) {
            return res.status(404).json({ error: "Current user not found" });
        }
        
        // Get profile user
        const profileUser = await userModel.findById(profileUserId);
        if (!profileUser) {
            return res.status(404).json({ error: "Profile user not found" });
        }
        
        // Check if current user is following the profile user
        const isFollowing = currentUser.following && 
            currentUser.following.some(id => id.toString() === profileUserId);
        
        // Check if there's a pending follow request
        const hasPendingRequest = profileUser.followRequests && 
            profileUser.followRequests.some(req => req.user && req.user.toString() === currentUser._id.toString());
        
        res.json({
            following: isFollowing,
            followRequested: hasPendingRequest,
            canViewPosts: true
        });
    } catch (error) {
        console.error("Error checking follow status:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// Explore route to discover new users
app.get("/explore", isLoggedIn, async (req, res) => {
    try {
        // Find current user
        let currentUser;
        if (req.user._id) {
            currentUser = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            currentUser = await userModel.findOne({ email: req.user.email });
        }

        if (!currentUser) {
            return res.redirect('/login');
        }

        // Get users that the current user doesn't follow
        const following = currentUser.following || [];
        
        // Find random users not already followed and not the current user
        // Using aggregation to get a random sample
        const suggestedUsers = await userModel.aggregate([
            {
                $match: {
                    _id: { 
                        $ne: currentUser._id,
                        $nin: following.map(id => typeof id === 'object' ? id : new mongoose.Types.ObjectId(id.toString())) 
                    }
                }
            },
            { $sample: { size: 20 } }, // Get random sample of 20 users
            { $project: { username: 1, name: 1, profileImage: 1, bio: 1 } }
        ]);
        
        // Convert ObjectIds to strings for proper rendering
        const formattedSuggestedUsers = suggestedUsers.map(user => ({
            ...user,
            _id: user._id.toString()
        }));
        
        // Get posts from all users for the explore grid
        // First fetch posts from all users, we'll filter private accounts after populating
        const explorePosts = await postModel.find({})
        .populate({
            path: 'user',
            select: 'username name profileImage private'
        })
        .populate({
            path: 'likes',
            select: 'username'
        })
        .populate({
            path: 'comments'
        })
        .sort({ createdAt: -1 })
        .limit(50);
        
        // Filter posts to only show public posts or posts from users the current user follows
        const filteredPosts = explorePosts.filter(post => {
            // Skip posts with null user
            if (!post.user) return false;
            
            // Allow posts if:
            // 1. The post is from a user with a public account
            // 2. Current user follows the post's creator
            // 3. The post is from the current user
            return !post.user.private || 
                   following.includes(post.user._id.toString()) || 
                   post.user._id.toString() === currentUser._id.toString();
        });

        res.render("explore", { 
            user: currentUser,
            suggestedUsers: formattedSuggestedUsers,
            explorePosts: filteredPosts
        });
    } catch (error) {
        console.error("Error fetching explore page:", error);
        res.status(500).send("Failed to load explore page");
    }
});

// Get comments for a post
app.get("/post/:postId/comments", isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findById(req.params.postId)
            .populate({
                path: 'comments',
                populate: [
                    {
                        path: 'user',
                        select: 'name username profileImage'
                    },
                    {
                        path: 'replies.user',
                        select: 'name username profileImage'
                    }
                ]
            });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        res.json({ comments: post.comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: "Error fetching comments" });
    }
});

// Delete post
app.delete('/post/:postId/delete', isLoggedIn, async (req, res) => {
    try {
        const postId = req.params.postId;
        console.log('Deleting post:', postId);
        
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        const post = await postModel.findById(postId);
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        
        // Check if user owns the post
        if (post.user.toString() !== user._id.toString()) {
            return res.status(403).json({ error: "You can only delete your own posts" });
        }
        
        console.log('User authorized to delete post');
        
        // Remove post from user's posts array
        user.posts = user.posts.filter(p => p.toString() !== postId);
        await user.save();
        
        // Delete all comments associated with the post
        await commentModel.deleteMany({ post: postId });
        
        // Delete the post itself
        const result = await postModel.findByIdAndDelete(postId);
        console.log('Post deleted:', result);
        
        res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ error: "Error deleting post: " + error.message });
    }
});

// Search users API endpoint
app.get("/api/search-users", isLoggedIn, async (req, res) => {
    try {
        const searchQuery = req.query.q;
        
        if (!searchQuery || searchQuery.length < 2) {
            return res.json({ users: [] });
        }
        
        // Find current user
        const currentUser = await userModel.findOne({ email: req.user.email });
        
        // Create regex for case-insensitive search
        const searchRegex = new RegExp(searchQuery, 'i');
        
        // Search in username and name fields
        const users = await userModel.find({
            $or: [
                { username: searchRegex },
                { name: searchRegex }
            ],
            _id: { $ne: currentUser._id } // Exclude current user
        })
        .select('username name profileImage bio')
        .limit(15);
        
        res.json({ users });
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ error: "Failed to search users" });
    }
});

// Import project routes
const projectRoutes = require('./routes/projects');

// Apply isLoggedIn middleware to all project routes
app.use('/api/projects', function(req, res, next) {
    isLoggedIn(req, res, function() {
        next();
    });
}, projectRoutes);

// Import notification routes
const notificationRoutes = require('./routes/api/notifications');
const usersRoutes = require('./routes/api/users');

// Apply notification routes with isLoggedIn middleware
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', isLoggedIn, usersRoutes);

// Projects page route
app.get('/projects', isLoggedIn, async (req, res) => {
    try {
        // Count pending project requests for the current user
        const pendingRequests = await Project.countDocuments({
            'joinRequests.user': req.user._id,
            'joinRequests.status': 'pending'
        });

        res.render('projects', {
            user: req.user,
            pendingRequests
        });
    } catch (error) {
        console.error('Error loading projects page:', error);
        res.status(500).render('error', { message: 'Error loading projects page' });
    }
});

// API route for followers
app.get('/api/user/:userId/followers', isLoggedIn, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching followers for user: ${userId}`);
        
        // Find the user and populate followers
        const user = await userModel.findById(userId)
            .populate('followers', 'name username email profileImage isOnline');
            
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log(`Found ${user.followers?.length || 0} followers`);
        res.json({ followers: user.followers || [] });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// API route for following
app.get('/api/user/:userId/following', isLoggedIn, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching following for user: ${userId}`);
        
        // Find the user and populate following
        const user = await userModel.findById(userId)
            .populate('following', 'name username email profileImage isOnline');
            
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log(`Found ${user.following?.length || 0} following`);
        res.json({ following: user.following || [] });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// New post deletion endpoint
app.delete('/api/post/:postId', isLoggedIn, async (req, res) => {
    try {
        console.log(`Received request to delete post: ${req.params.postId}`);
        
        // Check if user exists
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        // Check if post exists
        const post = await postModel.findById(req.params.postId);
        if (!post) {
            console.log('Post not found');
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        
        // Check if user owns the post
        if (post.user.toString() !== user._id.toString()) {
            console.log(`Unauthorized: User ${user._id} attempting to delete post by ${post.user}`);
            return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
        }
        
        console.log('Authorization passed, proceeding with deletion');
        
        // 1. Remove post from user's posts array
        await userModel.updateOne(
            { _id: user._id },
            { $pull: { posts: post._id } }
        );
        console.log('Removed post from user.posts array');
        
        // 2. Delete all comments related to this post
        const deletedComments = await commentModel.deleteMany({ post: post._id });
        console.log(`Deleted ${deletedComments.deletedCount} comments`);
        
        // 3. Delete the post
        const deletedPost = await postModel.deleteOne({ _id: post._id });
        console.log(`Post deletion result: ${JSON.stringify(deletedPost)}`);
        
        return res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error in post deletion:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});

// Import group routes
const groupRoutes = require('./routes/groups');

// Add group routes
app.use('/api/groups', isLoggedIn, groupRoutes);

// Add groups page route
app.get('/groups', isLoggedIn, (req, res) => {
    res.render('groups', { user: req.user });
});

// === EVENTS ROUTES ===

// Render events page
app.get("/events", isLoggedIn, (req, res) => {
    res.render("events", { user: req.user });
});

// Add current user API endpoint
app.get('/api/current-user', isLoggedIn, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
        _id: req.user._id,
        username: req.user.username,
        fullName: req.user.fullName,
        email: req.user.email,
        profileAvatar: req.user.profileAvatar
    });
});

// Import Event model from models folder
// const Event = require('./models/Event'); // Already imported at the top of the file

// Event Routes
app.get('/api/events',isLoggedIn,  async (req, res) => {
    try {
        const currentDate = new Date();
        const events = await Event.find({ endDateTime: { $gte: currentDate } })
            .sort({ startDateTime: 1 })
            .populate('organizer', 'username fullName email profileAvatar')
            .populate('attendees', 'username fullName email profileAvatar');

        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Error fetching events' });
    }
});

app.get('/api/events/past',isLoggedIn,  async (req, res) => {
    try {
        const currentDate = new Date();
        const events = await Event.find({ endDateTime: { $lt: currentDate } })
            .sort({ endDateTime: -1 })
            .populate('organizer', 'username fullName email profileAvatar')
            .populate('attendees', 'username fullName email profileAvatar');

        res.json(events);
    } catch (error) {
        console.error('Error fetching past events:', error);
        res.status(500).json({ error: 'Error fetching past events' });
    }
});

app.get('/api/events/:id',isLoggedIn,  async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const event = await Event.findById(req.params.id)
            .populate('organizer', 'username fullName email profileAvatar')
            .populate('attendees', 'username fullName email profileAvatar');

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const isAttending = req.user ? event.attendees.some(attendee => 
            attendee._id.toString() === req.user._id.toString()
        ) : false;

        res.json({
            ...event.toObject(),
            isAttending,
            attendeesCount: event.attendees.length
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Error fetching event details' });
    }
});

app.post('/api/events', isLoggedIn, async (req, res) => {
    // Use a try/catch around uploadEventImage middleware to handle file upload errors
    uploadEventImage(req, res, async function(err) {
        if (err) {
            console.error('File upload error:', err);
            return res.status(400).json({ error: 'File upload error: ' + err.message });
        }
        
        try {
            console.log('Event creation request received');
            console.log('Request body:', req.body);
            console.log('User:', req.user);
            console.log('File:', req.file);
            
            const {
                title,
                description,
                category,
                startDate,
                startTime,
                endDate,
                endTime,
                location,
                registrationLink
            } = req.body;

            console.log('Parsed data:', {
                title,
                description,
                category,
                startDate,
                startTime,
                endDate,
                endTime,
                location,
                registrationLink
            });

            // Validate required fields
            if (!title || !description || !category || !startDate || !startTime || !endDate || !endTime || !location) {
                console.log('Missing required fields');
                return res.status(400).json({ error: 'All required fields must be filled' });
            }

            try {
                // Combine date and time strings into Date objects
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);
                
                console.log('Parsed dates:', {
                    startDateTime: startDateTime.toISOString(),
                    endDateTime: endDateTime.toISOString()
                });

                // Validate dates
                if (endDateTime <= startDateTime) {
                    console.log('End date is before or equal to start date');
                    return res.status(400).json({ error: 'End date/time must be after start date/time' });
                }
                
                // Make sure user ID is a valid ObjectId
                if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
                    console.error('Invalid user ID:', req.user._id);
                    return res.status(400).json({ error: 'Invalid user ID' });
                }

                const eventData = {
                    title,
                    description,
                    category,
                    startDateTime,
                    endDateTime,
                    location,
                    organizer: req.user._id,
                    organizerName: req.user.fullName || req.user.username,
                    registrationLink: registrationLink || '',
                    image: req.file ? `/uploads/events/${req.file.filename}` : '/images/default-event.jpg'
                };
                
                console.log('Event data to save:', eventData);

                const newEvent = new Event(eventData);
                await newEvent.save();
                
                console.log('Event saved successfully with ID:', newEvent._id);

                // Populate organizer details before sending response
                await newEvent.populate('organizer', 'username fullName email profileAvatar');

                res.status(201).json(newEvent);
            } catch (dateError) {
                console.error('Date parsing error:', dateError);
                return res.status(400).json({ error: 'Invalid date format: ' + dateError.message });
            }
        } catch (error) {
            console.error('Error creating event:', error);
            res.status(500).json({ error: 'Error creating event: ' + error.message });
        }
    });
});

app.post('/api/events/:id/attend', isLoggedIn, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if event has ended
        const currentDate = new Date();
        if (event.endDateTime < currentDate) {
            return res.status(400).json({ error: 'Cannot attend past events' });
        }

        const userId = req.user._id;
        const isAttending = event.attendees.includes(userId);

        if (isAttending) {
            // Remove user from attendees
            event.attendees = event.attendees.filter(id => id.toString() !== userId.toString());
        } else {
            // Add user to attendees
            event.attendees.push(userId);
        }

        await event.save();

        // Populate event details before sending response
        await event.populate('organizer', 'username fullName email profileAvatar');
        await event.populate('attendees', 'username fullName email profileAvatar');

        res.json({
            message: isAttending ? 'Successfully unattended event' : 'Successfully attended event',
            event: event.toObject(),
            isAttending: !isAttending,
            attendeesCount: event.attendees.length
        });
    } catch (error) {
        console.error('Error updating event attendance:', error);
        res.status(500).json({ error: 'Error updating event attendance' });
    }
});

// Send follow request
app.post('/follow/:username', isLoggedIn, async (req, res) => {
    try {
        const userToFollow = await userModel.findOne({ username: req.params.username });
        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const currentUser = await userModel.findOne({ email: req.user.email });
        
        // Check if user is not already being followed
        if (currentUser.following.includes(userToFollow._id)) {
            return res.status(400).json({ message: 'You are already following this user' });
        }
        
        // Always directly add to following/followers (no private account checks)
        currentUser.following.push(userToFollow._id);
        await currentUser.save();
        
        userToFollow.followers.push(currentUser._id);
        await userToFollow.save();
        
        // Send notification
        try {
            const {
                createFollowNotification
            } = require('./utils/notifications');
            
            await createFollowNotification({
                recipientId: userToFollow._id,
                senderId: currentUser._id,
                senderName: currentUser.name || 'Someone'
            });
        } catch (notifError) {
            console.error('Error creating follow notification:', notifError);
            // Continue even if notification fails
        }
        
        res.json({ message: 'Following user' });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// API endpoint for following/unfollowing a user
app.post("/user/:username/follow", isLoggedIn, async (req, res) => {
    try {
        const { username } = req.params;
        const { action } = req.body; // 'follow' or 'unfollow'
        
        // Get current user
        let currentUser = await userModel.findOne({ email: req.user.email });
        if (!currentUser) {
            return res.status(404).json({ error: "Current user not found" });
        }
        
        // Get target user
        const targetUser = await userModel.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Prevent self-follow
        if (currentUser._id.toString() === targetUser._id.toString()) {
            return res.status(400).json({ error: "You cannot follow yourself" });
        }
        
        if (action === 'follow') {
            // Always directly follow the user (no private account checks)
            
            // Check if already following
            if (currentUser.following.includes(targetUser._id)) {
                return res.status(400).json({ error: "Already following this user" });
            }
            
            // Add to current user's following
            currentUser.following.push(targetUser._id);
            await currentUser.save();
            
            // Add to target user's followers
            targetUser.followers.push(currentUser._id);
            await targetUser.save();
            
            // Create notification for the followed user
            await createNotification(
                targetUser._id,
                currentUser._id,
                'follow'
            );
            
            return res.json({ 
                success: true, 
                following: true,
                message: `You are now following ${targetUser.username}`
            });
        } else if (action === 'unfollow') {
            // Remove from current user's following
            currentUser.following = currentUser.following.filter(
                id => id.toString() !== targetUser._id.toString()
            );
            await currentUser.save();
            
            // Remove from target user's followers
            targetUser.followers = targetUser.followers.filter(
                id => id.toString() !== currentUser._id.toString()
            );
            await targetUser.save();
            
            return res.json({ 
                success: true,
                following: false,
                message: `You have unfollowed ${targetUser.username}`
            });
        } else {
            return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error) {
        console.error('Error in follow/unfollow:', error);
        res.status(500).json({ error: "Server error" });
    }
});

// Handle profile update
app.post("/edit-profile", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        // Extract updated fields from the request (ignore isPrivate)
        const { name, username, bio } = req.body;
        
        // Update user fields
        user.name = name || user.name;
        user.username = username || user.username;
        user.bio = bio || user.bio;
        // Don't update isPrivate anymore - remove that functionality
        
        await user.save();
        res.redirect("/edit-profile");
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Error updating profile: ' + error.message);
    }
});

