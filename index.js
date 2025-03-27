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
const bcrypt = require('bcrypt');
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

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = socketModule.initSocket(server);

// Make io available globally for notification real-time updates
global.io = io;

// Add this near the top of the file where other environment variables are setup
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";

// MongoDB connection - commented out to avoid duplicate connections
// mongoose.connect('mongodb://localhost:27017/jccbuzz')
//     .then(() => console.log('Connected to MongoDB'))
//     .catch(err => console.error('MongoDB connection error:', err));

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
    storage: postStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).array('processedImages', 10); // Max 10 images

// Configure multer for story upload
const storyStorage = multer.memoryStorage();
const uploadStory = multer({ 
    storage: storyStorage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
}).single('story');

// Configure multer storage for chat media uploads
const chatMediaStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/uploads/chat');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'chat-' + uniqueSuffix + ext);
    }
});

// Filter for images and videos
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
const uploadVoiceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/uploads/voice');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, req.user._id + '-' + Date.now() + '-' + file.originalname);
    }
});

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


app.post("/post", isLoggedIn, uploadPostImages, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!req.body.title || !req.body.content) {
            return res.status(400).send("Title and content are required");
        }
        
        const { title, content } = req.body;
        
        // Process images
        let processedImages = [];
        if (req.files && req.files.length > 0) {
            processedImages = await Promise.all(
                req.files.map(async (file) => {
                    const processedBuffer = await sharp(file.buffer)
                        .resize(1080, 1080, { fit: 'inside' })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                    
                    const filename = `post-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
                    const imagePath = path.join('public/uploads/posts', filename);
                    await sharp(processedBuffer).toFile(imagePath);
                    
                    return {
                        url: `/uploads/posts/${filename}`,
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
app.post('/upload-profile-pic', isLoggedIn, (req, res) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading
            return res.status(400).send(err.message);
        } else if (err) {
            // An unknown error occurred
            return res.status(400).send(err.message);
        }
        
        // Everything went fine
        if (!req.file) {
            return res.status(400).send('Please select an image file.');
        }

        // Process the valid upload
        processUpload(req, res);
    });
});

// Separate function to handle the actual upload processing
async function processUpload(req, res) {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Delete old profile image if it exists and isn't the default
        if (user.profileImage && !user.profileImage.includes('default-profile.png')) {
            const oldImagePath = path.join(__dirname, 'public', user.profileImage);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }
        
        user.profileImage = '/uploads/profiles/' + req.file.filename;
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
        const { name, username, bio, isPrivate } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        
        user.name = name;
        user.username = username;
        user.bio = bio;
        // Handle privacy settings (checkbox will be undefined if unchecked)
        user.isPrivate = isPrivate === 'on';
        
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
            
            // Determine media type
            let mediaType = 'none';
            if (req.file) {
                mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
            }
            
            // Create message
            const message = {
                sender: user._id,
                content: content || '',
                mediaType,
                mediaUrl: req.file ? `/uploads/chat/${req.file.filename}` : null,
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
app.post("/story", isLoggedIn, uploadStory, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        if (!req.file) {
            return res.status(400).json({ error: "No media file provided" });
        }

        const filename = `story-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const imagePath = path.join('public/uploads/stories', filename);

        // Process image to maintain mobile-like aspect ratio
        await sharp(req.file.buffer)
            .resize({
                width: 1080,
                height: 1920,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            })
            .jpeg({ quality: 85 })
            .toFile(imagePath);

        // Parse text overlay and emojis from request
        const textOverlay = req.body.textOverlay ? JSON.parse(req.body.textOverlay) : null;
        const emojis = req.body.emojis ? JSON.parse(req.body.emojis) : [];

        const story = await storyModel.create({
            user: user._id,
            media: {
                url: `/uploads/stories/${filename}`,
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

        // Delete story media file
        const filePath = path.join(__dirname, 'public', story.media.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await story.delete();
        res.json({ message: "Story deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting story" });
    }
});

// Mark story as viewed
app.post("/story/:storyId/view", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const story = await storyModel.findById(req.params.storyId);
        
        if (!story) {
            return res.status(404).json({ error: "Story not found" });
        }

        // Check if user already viewed this story
        if (!story.viewers) {
            story.viewers = [];
        }
        
        // Make sure we're using a consistent format for comparing IDs
        const userIdStr = user._id.toString();
        const viewerExists = story.viewers.some(viewer => 
            viewer && (viewer.toString() === userIdStr || 
            (viewer.user && viewer.user.toString() === userIdStr))
        );
        
        if (!viewerExists) {
            // Add user to viewers list
            story.viewers.push(user._id);
            await story.save();
            
            console.log(`User ${user._id} marked story ${story._id} as viewed`);
        }

        // Get all stories for this user to check if all are viewed
        const userStories = await storyModel.find({
            user: story.user,
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        const allViewed = userStories.every(s => 
            s.viewers && s.viewers.some(v => 
                (v.toString() === userIdStr || (v.user && v.user.toString() === userIdStr))
            )
        );

        res.json({ 
            message: "Story marked as viewed",
            allStoriesViewed: allViewed
        });
    } catch (error) {
        console.error('Error marking story as viewed:', error);
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

        // Add story reply message
        const newMessage = {
            sender: user._id,
            content: message,
            isStoryReply: true,
            storyId: story._id,
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
                storyId: story._id
            });
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

// Add this after all your middleware setup
const connectedUsers = new Map(); // Store online users

io.on('connection', (socket) => {
    let currentUserId = null;

    socket.on('authenticate', async (userData) => {
        // Extract userId - it could be a string or an object with userId property
        const userId = typeof userData === 'object' && userData.userId ? userData.userId : userData;
        
        currentUserId = userId;
        socket.userId = userId;
        connectedUsers.set(userId, socket.id);
        
        try {
            await userModel.findByIdAndUpdate(userId, { isOnline: true });
            io.emit('userOnline', userId);
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    });

    socket.on('typing', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('userTyping', {
                chatId: data.chatId,
                userId: socket.userId
            });
        }
    });

    socket.on('messageDeleted', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('messageDeleted', {
                chatId: data.chatId,
                messageId: data.messageId
            });
        }
    });

    socket.on('messageReacted', (data) => {
        const receiverSocketId = connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('messageReacted', {
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
                io.emit('userOffline', currentUserId);
            } catch (error) {
                console.error('Error updating offline status:', error);
            }
        }
    });

    // Voice Call Signaling
    // When a user initiates a call
    socket.on('callUser', (data) => {
        const { userToCall, signalData, from, fromName } = data;
        io.to(userSocketIdMap[userToCall]).emit('incomingCall', {
            signal: signalData,
            from,
            fromName
        });
    });

    // When a user accepts a call
    socket.on('answerCall', (data) => {
        const { signal, to } = data;
        io.to(userSocketIdMap[to]).emit('callAccepted', signal);
    });

    // When a user rejects a call
    socket.on('rejectCall', (data) => {
        const { from, to } = data;
        io.to(userSocketIdMap[from]).emit('callRejected', { from: to });
    });

    // When a user ends a call
    socket.on('endCall', (data) => {
        const { to } = data;
        io.to(userSocketIdMap[to]).emit('callEnded');
    });

    // When user is unavailable for call
    socket.on('userBusy', (data) => {
        const { from } = data;
        io.to(userSocketIdMap[from]).emit('userBusy');
    });
});

// Change app.listen to server.listen
server.listen(3000);

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
    if (!req.user) {
        return next();
    }
    
    try {
        // Find the user by ID or email
        let user;
        if (req.user._id) {
            user = await userModel.findById(req.user._id);
        } else if (req.user.email) {
            user = await userModel.findOne({ email: req.user.email });
        }
        
        if (user && user.followRequests) {
            res.locals.followRequestsCount = user.followRequests.length;
        }
    } catch (error) {
        console.error('Error fetching follow requests count:', error);
    }
    next();
}

// Apply this middleware after other middleware
app.use(fetchFollowRequestsCount);

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
