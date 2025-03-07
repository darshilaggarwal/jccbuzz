const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const userModel = require("./models/user");  
const postModel = require("./models/post")
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const commentModel = require("./models/comment");
const chatModel = require("./models/chat");
const sharp = require('sharp');
const storyModel = require("./models/story");
const session = require('express-session');
const passport = require('./config/passport');

// mongoose.connect('mongodb://localhost:27017/pinspire')
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
    let user = await userModel.findOne({email : req.user.email}).populate("posts");

    
    res.render("profile" , {user})
})

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
    let { email, username, name, password } = req.body;
 
    let user = await userModel.findOne({email})
    if (user) return res.status(500).send("user registered")

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                name, 
                email, 
                username, 
                password: hash,
                posts: [] // Initialize empty posts array
            });

            let token = jwt.sign({email: email}, "shhhh");
            res.cookie("token", token);
            // Instead of directly rendering, redirect to profile
            res.redirect("/profile");
        })
    })
})

app.post("/login" , async (req,res)=>{

    let { email , password} = req.body;

    let user = await userModel.findOne({email})
    if (!user) return res.status(300).send("user needs to be registered")

        bcrypt.compare(password , user.password , (err, result)=>{
            if (result) {
                let token = jwt.sign({ email: user.email }, "shhhh");
                res.cookie("token", token);
                return res.redirect("/profile");
            }
            res.redirect("/login");
        })

})
  
app.get("/logout" , (req,res)=>{
    res.cookie("token" , "")
    res.redirect("/")
    // res.render("landing")
})

function isLoggedIn(req, res, next) {
    if (!req.cookies.token || req.cookies.token === "") {
        res.redirect("/");
    } else {
        try {
            let data = jwt.verify(req.cookies.token, "shhhh");
            req.user = data;
            next();
        } catch (error) {
            res.status(401).send("Invalid token");
        }
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
    const posts = await postModel.find({ user: { $ne: null } })
        .populate('user', 'username name profileImage')
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
    
    const currentUser = await userModel.findOne({ email: req.user.email });
    res.render("feed", { posts, user: currentUser });
});

app.post("/post/:postId/like", isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findById(req.params.postId);
        const user = await userModel.findOne({ email: req.user.email });

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        // Check if the user has already liked the post
        if (!post.likes.includes(user._id)) {
            post.likes.push(user._id);
            await post.save();
            res.json({ message: "Post liked", likes: post.likes.length });
        } else {
            return res.status(400).json({ error: "Post already liked" });
        }
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: "Error liking post" });
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

        const comment = await commentModel.create({
            content,
            user: user._id,
            post: post._id,
            likes: [],
            replies: []
        });

        post.comments.push(comment._id);
        await post.save();

        res.json(await comment.populate('user', 'name username profileImage'));
    } catch (error) {
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
        
        res.json(comment.replies[comment.replies.length - 1]);
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
        const reply = comment.replies[req.params.replyIndex];

        const isLiked = reply.likes.includes(user._id);

        if (isLiked) {
            reply.likes = reply.likes.filter(id => id.toString() !== user._id.toString());
        } else {
            reply.likes.push(user._id);
        }

        await comment.save();
        res.json({ likes: reply.likes.length, isLiked: !isLiked });
    } catch (error) {
        res.status(500).json({ error: "Error processing like" });
    }
});

// View other user's profile
app.get("/user/:username", isLoggedIn, async (req, res) => {
    try {
        const profileUser = await userModel.findOne({ username: req.params.username })
            .populate({
                path: 'posts',
                populate: {
                    path: 'user',
                    select: 'username name profileImage'
                }
            });

        if (!profileUser) {
            return res.status(404).send("User not found");
        }

        const isOwnProfile = profileUser.email === req.user.email;
        res.render("userProfile", { 
            profileUser, 
            user: await userModel.findOne({ email: req.user.email }),
            isOwnProfile 
        });
    } catch (error) {
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

        // Check if username is being changed and is not taken
        if (username !== user.username) {
            const existingUser = await userModel.findOne({ username });
            if (existingUser) {
                return res.status(400).send("Username already taken");
            }
        }

        user.name = name;
        user.username = username;
        user.bio = bio;

        await user.save();
        res.redirect("/profile");
    } catch (error) {
        res.status(500).send("Error updating profile");
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

        let chat = await chatModel.findOne({
            participants: { $all: [currentUser._id, otherUser._id] }
        }).populate('participants', 'name username profileImage isOnline')
          .populate('messages.sender', 'name username profileImage');

        if (!chat) {
            chat = await chatModel.create({
                participants: [currentUser._id, otherUser._id],
                messages: []
            });
            await chat.populate('participants', 'name username profileImage isOnline');
        }

        res.render("chat", { user: currentUser, chat, otherUser });
    } catch (error) {
        res.status(500).send("Error loading chat");
    }
});

// Send message
app.post("/chat/:chatId/message", isLoggedIn, async (req, res) => {
    try {
        const { content } = req.body;
        const user = await userModel.findOne({ email: req.user.email });
        const chat = await chatModel.findById(req.params.chatId);

        chat.messages.push({
            sender: user._id,
            content
        });
        chat.lastMessage = Date.now();
        await chat.save();

        // Populate the new message
        const newMessage = chat.messages[chat.messages.length - 1];
        await chat.populate('messages.sender', 'name username profileImage');

        res.json(newMessage);
    } catch (error) {
        res.status(500).json({ error: "Error sending message" });
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

        const story = await storyModel.create({
            user: user._id,
            media: {
                url: `/uploads/stories/${filename}`,
                type: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
            }
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
        const stories = await storyModel.find({
            createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).populate('user', 'username name profileImage')
          .sort({ createdAt: -1 });

        res.json(stories);
    } catch (error) {
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

        // Create or get existing chat
        let chat = await chatModel.findOne({
            participants: { $all: [user._id, story.user._id] }
        });

        if (!chat) {
            chat = await chatModel.create({
                participants: [user._id, story.user._id],
                messages: []
            });
        }

        // Add story reply message
        const message = {
            sender: user._id,
            content: req.body.content,
            isStoryReply: true,
            storyId: story._id
        };

        chat.messages.push(message);
        chat.lastMessage = Date.now();
        await chat.save();

        // Notify story owner through socket
        const storyOwnerSocketId = connectedUsers.get(story.user._id.toString());
        if (storyOwnerSocketId) {
            io.to(storyOwnerSocketId).emit('storyReply', {
                from: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage
                },
                content: req.body.content,
                storyId: story._id
            });
        }

        res.json({ message: "Reply sent successfully" });
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

    socket.on('privateMessage', async (data) => {
        try {
            const { chatId, content, receiverId } = data;
            const sender = await userModel.findById(socket.userId);
            
            const chat = await chatModel.findById(chatId);
            const newMessage = {
                sender: sender._id,
                content,
                timestamp: new Date()
            };
            
            chat.messages.push(newMessage);
            chat.lastMessage = new Date();
            await chat.save();

            const messageToSend = {
                ...newMessage,
                sender: {
                    _id: sender._id,
                    name: sender.name,
                    profileImage: sender.profileImage
                }
            };

            // Send to receiver if online
            const receiverSocketId = connectedUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('newMessage', {
                    chatId,
                    message: messageToSend
                });
            }

            // Confirm to sender
            socket.emit('messageSent', {
                chatId,
                message: messageToSend
            });
        } catch (error) {
            console.error('Message error:', error);
            socket.emit('messageError', { error: 'Failed to send message' });
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

// Google OAuth routes
app.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
);

app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login' 
    }),
    function(req, res) {
        // Create JWT token
        const token = jwt.sign({
            name: req.user.name,
            email: req.user.email
        }, "shhhh");
        
        // Set cookie
        res.cookie("token", token);
        
        // Redirect to profile page
        res.redirect('/profile');
    }
);