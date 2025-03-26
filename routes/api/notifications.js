const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../../index.js');
const userModel = require('../../models/user');
const notificationModel = require('../../models/notification');

// Get all notifications (including both project and social)
router.get("/", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ 
            recipient: user._id
        })
        .populate('sender', 'name email username profileImage')
        .sort({ createdAt: -1 })
        .limit(limit);
        
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: "Error fetching notifications" });
    }
});

// Get project notifications only
router.get("/projects", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ 
            recipient: user._id,
            type: { $regex: /^project_/ } // Only project-related notifications
        })
        .populate('sender', 'name email username profileImage')
        .sort({ createdAt: -1 })
        .limit(limit);
        
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching project notifications:', error);
        res.status(500).json({ error: "Error fetching project notifications" });
    }
});

// Get social notifications only (likes, comments, follows)
router.get("/social", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ 
            recipient: user._id,
            type: { $not: { $regex: /^project_/ } } // Exclude project notifications
        })
        .populate('sender', 'name email username profileImage')
        .sort({ createdAt: -1 })
        .limit(limit);
        
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching social notifications:', error);
        res.status(500).json({ error: "Error fetching social notifications" });
    }
});

// Mark notification as read
router.put("/:id/read", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        const notification = await notificationModel.findOneAndUpdate(
            { 
                _id: req.params.id, 
                recipient: user._id 
            },
            { read: true, readAt: new Date() },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }
        
        // Get updated unread count (all notifications)
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
router.post("/mark-all-read", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        await notificationModel.updateMany(
            { 
                recipient: user._id, 
                read: false
            },
            { read: true, readAt: new Date() }
        );
        
        res.json({ success: true, unreadCount: 0 });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: "Error marking all notifications as read" });
    }
});

// Get unread notification count (all notifications)
router.get("/count", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const count = await notificationModel.countDocuments({
            recipient: user._id,
            read: false
        });
        res.json({ count });
    } catch (error) {
        console.error('Error fetching notification count:', error);
        res.status(500).json({ error: "Error fetching notification count" });
    }
});

// Get unread project notification count
router.get("/count/projects", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const count = await notificationModel.countDocuments({
            recipient: user._id,
            read: false,
            type: { $regex: /^project_/ }
        });
        res.json({ count });
    } catch (error) {
        console.error('Error fetching project notification count:', error);
        res.status(500).json({ error: "Error fetching project notification count" });
    }
});

// Get unread social notification count
router.get("/count/social", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const count = await notificationModel.countDocuments({
            recipient: user._id,
            read: false,
            type: { $not: { $regex: /^project_/ } }
        });
        res.json({ count });
    } catch (error) {
        console.error('Error fetching social notification count:', error);
        res.status(500).json({ error: "Error fetching social notification count" });
    }
});

// Get all unread notifications
router.get("/unread", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        let notifications = await notificationModel.find({ 
            recipient: user._id,
            read: false
        })
        .populate('sender', 'name email username profileImage')
        .sort({ createdAt: -1 })
        .limit(limit);
        
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        res.status(500).json({ error: "Error fetching unread notifications" });
    }
});

module.exports = router; 