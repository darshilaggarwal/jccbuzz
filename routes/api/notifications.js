const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../../index.js');
const userModel = require('../../models/user');
const notificationModel = require('../../models/notification');

// Get notifications
router.get("/", isLoggedIn, async (req, res) => {
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

// Mark notification as read
router.post("/:id/read", isLoggedIn, async (req, res) => {
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
router.post("/mark-all-read", isLoggedIn, async (req, res) => {
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

// Get unread notification count
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

module.exports = router; 