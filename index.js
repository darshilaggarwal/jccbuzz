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
const StudentVerification = require('./models/studentVerification');
const LoginVerification = require('./models/loginVerification');
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

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server);

// Add this near the top of the file where other environment variables are setup
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";

// Update commented MongoDB connection string
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
            
            // Create notifications for each follower
            const notificationPromises = followers.map(follower => 
                createNotification(follower._id, user._id, 'new_post', post._id)
            );
            
            // Wait for all notifications to be created
            await Promise.all(notificationPromises);
            
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
        req.user = data;
        console.log('User authenticated via JWT');
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        res.redirect("/login?error=session_expired");
    }
}

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

        const index = post.likes.indexOf(user._id);
        const isLiked = index !== -1;

        if (isLiked) {
            // User has already liked the post, so unlike it
            post.likes.splice(index, 1);
            await post.save();
            return res.json({ likes: post.likes.length, isLiked: false });
        } else {
            // User hasn't liked the post, so add their like
            post.likes.push(user._id);
            await post.save();
            
            // Create notification for post like
            if (post.user.toString() !== user._id.toString()) {
                await createNotification(post.user, user._id, 'like', post._id);
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
            await createNotification(post.user, user._id, 'comment', post._id, comment._id);
        }
        
        // Check for mentions in the comment
        const mentionRegex = /@(\w+)/g;
        const mentions = content.match(mentionRegex);
        
        if (mentions) {
            const usernames = mentions.map(mention => mention.substring(1));
            
            // Find mentioned users and notify them
            const mentionedUsers = await userModel.find({
                username: { $in: usernames }
            });
            
            for (const mentionedUser of mentionedUsers) {
                // Don't notify yourself or the post owner (who already gets a comment notification)
                if (mentionedUser._id.toString() !== user._id.toString() && 
                    mentionedUser._id.toString() !== post.user.toString()) {
                    await createNotification(mentionedUser._id, user._id, 'mention', post._id, comment._id);
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
            await createNotification(comment.user, user._id, 'reply', post._id, comment._id);
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
                    await createNotification(mentionedUser._id, user._id, 'mention', post._id, comment._id);
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
                // Get the post for context
                const post = await postModel.findById(comment.post);
                await createNotification(comment.user, user._id, 'comment_like', post._id, comment._id);
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
                // Get the post for context
                const post = await postModel.findById(comment.post);
                await createNotification(reply.user, user._id, 'reply_like', post._id, comment._id);
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

    socket.on('authenticate', async (userId) => {
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
            
            // Create message
            const message = {
                sender: user._id,
                content: '', // No text content for voice messages
                mediaType: 'audio',
                mediaUrl: `/uploads/voice/${req.file.filename}`,
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
                // Always show OTP in development mode
                if (process.env.NODE_ENV !== 'production') {
                    return res.status(200).json({ 
                        success: true, 
                        message: "Development mode: OTP saved but email failed",
                        dev_otp: otp,
                        expires_at: expiresAt,
                        student_email: student.email
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
                    await createNotification(userToFollow._id, currentUser._id, 'followRequest');
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
                await createNotification(userToFollow._id, currentUser._id, 'follow');
                
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

// Function to create a notification
async function createNotification(recipientId, senderId, type, postId = null, commentId = null, storyId = null) {
    try {
        // Skip notification if sender and recipient are the same
        if (recipientId.toString() === senderId.toString()) {
            return null;
        }
        
        // Get recipient's notification settings
        const recipient = await userModel.findById(recipientId);
        if (!recipient) {
            console.log(`Notification not created: Recipient ${recipientId} not found`);
            return null;
        }
        
        // Check notification preferences
        if (recipient.notificationSettings) {
            // Skip if user has disabled this notification type
            if (type === 'like' && recipient.notificationSettings.likes === false) return null;
            if ((type === 'comment' || type === 'comment_like' || type === 'reply' || type === 'reply_like') && recipient.notificationSettings.comments === false) return null;
            if ((type === 'follow' || type === 'followAccepted') && recipient.notificationSettings.follows === false) return null;
            if (type === 'new_post' && recipient.notificationSettings.postUpdates === false) return null;
        }
        
        // Set proper notification text
        let text = '';
        switch (type) {
            case 'like':
                text = 'liked your post.';
                break;
            case 'comment':
                text = 'commented on your post.';
                break;
            case 'comment_like':
                text = 'liked your comment.';
                break;
            case 'reply':
                text = 'replied to your comment.';
                break;
            case 'reply_like':
                text = 'liked your reply.';
                break;
            case 'follow':
                text = 'started following you.';
                break;
            case 'followAccepted':
                text = 'accepted your follow request.';
                break;
            case 'new_post':
                text = 'shared a new post.';
                break;
            case 'mention':
                text = 'mentioned you in a post.';
                break;
            default:
                text = 'interacted with your content.';
        }
        
        const notification = new notificationModel({
            recipient: recipientId,
            sender: senderId,
            type: type,
            text: text,
            post: postId,
            comment: commentId,
            story: storyId,
            read: false,
            createdAt: new Date()
        });
        
        await notification.save();
        
        // Populate notification data for socket emission
        const populatedNotification = await notificationModel.findById(notification._id)
            .populate('sender', 'name username profileImage')
            .populate({
                path: 'post',
                select: 'images',
                populate: {
                    path: 'images',
                    select: 'url'
                }
            });
        
        // Emit socket event if recipient is online
        if (io && global.connectedUsers && global.connectedUsers[recipientId]) {
            const socketId = global.connectedUsers[recipientId];
            io.to(socketId).emit('newNotification', { notification: populatedNotification });
        }
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

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
            // Follow
            await userModel.findByIdAndUpdate(user._id, {
                $addToSet: { following: userToFollow._id }
            });
            await userModel.findByIdAndUpdate(userToFollow._id, {
                $addToSet: { followers: user._id }
            });
            
            // Create notification for new follower
            await createNotification(userToFollow._id, user._id, 'follow');
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
        console.error('Error processing follow:', error);
        res.status(500).json({ error: "Error processing follow request" });
    }
});

// API endpoints for notifications
// Get notifications
app.get("/api/notifications", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ recipient: user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name username profileImage')
            .populate({
                path: 'post',
                select: 'images'
            })
            .populate('comment', 'content')
            .populate('story');
        
        // Filter out notifications with missing senders except for specific types
        const validNotifications = notifications.filter(notification => {
            return notification.sender !== null || notification.type === 'new_post';
        });
        
        res.json({ notifications: validNotifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: "Error fetching notifications" });
    }
});

// Mark notification as read
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

// Mark all notifications as read
app.post("/api/notifications/mark-all-read", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        await notificationModel.updateMany(
            { recipient: user._id, read: false },
            { read: true }
        );
        
        // Return 0 as the unread count since we just marked all as read
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
            .sort({ createdAt: -1 })
            .populate('sender', 'name username profileImage')
            .populate({
                path: 'post',
                select: 'images'
            })
            .populate('comment', 'content')
            .populate('story');
        
        // Clean up notifications with missing senders
        const validNotifications = notifications.filter(notification => {
            // Keep notifications where sender exists or type is 'new_post'
            return notification.sender !== null || notification.type === 'new_post';
        });
        
        // Mark notifications as viewed when opening notifications page
        // This doesn't mark them as "read" yet
        res.render("notifications", { notifications: validNotifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.redirect("/feed");
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
    try {
        // Get the current user with fully populated follow requests
        const user = await userModel.findOne({ email: req.user.email })
            .populate({
                path: 'followRequests.user',
                select: 'name username profileImage'
            });
        
        if (!user) {
            return res.redirect("/login");
        }
        
        res.render("followRequests", { user });
    } catch (error) {
        console.error('Error fetching follow requests:', error);
        res.status(500).send("Error fetching follow requests");
    }
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
            canViewPosts: !profileUser.isPrivate || isFollowing
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
        const user = await userModel.findOne({ email: req.user.email });
        const post = await postModel.findById(postId);
        
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }
        
        // Check if user owns the post
        if (post.user.toString() !== user._id.toString()) {
            return res.status(403).json({ error: "You can only delete your own posts" });
        }
        
        // Delete all comments associated with the post
        await commentModel.deleteMany({ post: postId });
        
        // Delete post images from cloud storage
        if (post.images && post.images.length > 0) {
            for (const image of post.images) {
                // If using cloudinary or similar service, delete the image
                // Example: await cloudinary.uploader.destroy(image.public_id);
            }
        }
        
        // Delete the post itself
        await postModel.findByIdAndDelete(postId);
        
        res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ error: "Error deleting post" });
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

