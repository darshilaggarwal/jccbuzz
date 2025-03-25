const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Group = require('../models/Group');
const User = require('../models/user');
const { isLoggedIn } = require('../index.js');
const { createNotification } = require('../utils/notifications');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/groups');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

// Get all groups for current user
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user._id })
            .populate('admin', 'name email profileImage')
            .populate('lastMessage.sender', 'name')
            .sort('-lastMessage.timestamp');
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

// Create new group
router.post('/', isLoggedIn, async (req, res) => {
    try {
        const { name, members } = req.body;
        
        if (!name || !members || !Array.isArray(members)) {
            return res.status(400).json({ error: 'Invalid group data' });
        }

        // Add current user as admin and member
        const allMembers = [...new Set([...members, req.user._id])];
        
        const group = new Group({
            name,
            admin: req.user._id,
            members: allMembers
        });

        await group.save();

        // Notify all members about the new group
        for (const memberId of members) {
            await createNotification({
                recipient: memberId,
                sender: req.user._id,
                type: 'group_added',
                title: 'Added to New Group',
                message: `${req.user.name} added you to the group "${name}"`,
                data: { groupId: group._id }
            });
        }

        // Populate admin details before sending response
        await group.populate('admin', 'name email profileImage');
        
        res.status(201).json(group);
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Get specific group details
router.get('/:groupId', isLoggedIn, async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        })
        .populate('admin', 'name email profileImage')
        .populate('members', 'name email profileImage isOnline');

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'Failed to fetch group details' });
    }
});

// Get group messages
router.get('/:groupId/messages', isLoggedIn, async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        }).populate('messages.sender', 'name email profileImage');

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json(group.messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get group members
router.get('/:groupId/members', isLoggedIn, async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        }).populate('members', 'name email profileImage isOnline');

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json(group.members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// Add new message to group
router.post('/:groupId/messages', isLoggedIn, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const message = {
            sender: req.user._id,
            content,
            timestamp: new Date()
        };

        group.messages.push(message);
        group.lastMessage = {
            content,
            sender: req.user._id,
            timestamp: new Date()
        };

        await group.save();

        // Populate sender details for the response
        await Group.populate(message, { path: 'sender', select: 'name email profileImage' });

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Add members to group
router.post('/:groupId/members', isLoggedIn, async (req, res) => {
    try {
        const { members } = req.body;
        
        if (!members || !Array.isArray(members)) {
            return res.status(400).json({ error: 'Invalid members data' });
        }

        const group = await Group.findOne({
            _id: req.params.groupId,
            admin: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found or you are not the admin' });
        }

        // Add new members
        const newMembers = members.filter(id => !group.members.includes(id));
        group.members.push(...newMembers);

        await group.save();

        // Notify new members
        for (const memberId of newMembers) {
            await createNotification({
                recipient: memberId,
                sender: req.user._id,
                type: 'group_added',
                title: 'Added to Group',
                message: `${req.user.name} added you to the group "${group.name}"`,
                data: { groupId: group._id }
            });
        }

        await group.populate('members', 'name email profileImage isOnline');
        
        res.json(group.members);
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ error: 'Failed to add members' });
    }
});

// Leave group
router.post('/:groupId/leave', isLoggedIn, async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // If admin is leaving, assign new admin if there are other members
        if (group.admin.toString() === req.user._id.toString()) {
            const otherMembers = group.members.filter(id => id.toString() !== req.user._id.toString());
            
            if (otherMembers.length > 0) {
                group.admin = otherMembers[0];
                group.members = group.members.filter(id => id.toString() !== req.user._id.toString());
                await group.save();

                // Notify new admin
                await createNotification({
                    recipient: otherMembers[0],
                    sender: req.user._id,
                    type: 'group_admin',
                    title: 'New Group Admin',
                    message: `You are now the admin of the group "${group.name}"`,
                    data: { groupId: group._id }
                });
            } else {
                // Delete group if no members left
                await Group.deleteOne({ _id: group._id });
            }
        } else {
            // Regular member leaving
            group.members = group.members.filter(id => id.toString() !== req.user._id.toString());
            await group.save();
        }

        res.json({ message: 'Successfully left the group' });
    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).json({ error: 'Failed to leave group' });
    }
});

// Upload group avatar
router.post('/:groupId/avatar', isLoggedIn, upload.single('avatar'), async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            admin: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found or you are not the admin' });
        }

        // Delete old avatar if exists
        if (group.avatar) {
            const oldAvatarPath = path.join(__dirname, '../public', group.avatar);
            await fs.unlink(oldAvatarPath).catch(() => {});
        }

        group.avatar = '/uploads/groups/' + req.file.filename;
        await group.save();

        res.json({ avatar: group.avatar });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Upload file to group chat
router.post('/:groupId/upload', isLoggedIn, upload.single('file'), async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const fileUrl = '/uploads/groups/' + req.file.filename;
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

        res.json({ fileUrl, type: fileType });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Add reaction to message
router.post('/:groupId/messages/:messageId/react', isLoggedIn, async (req, res) => {
    try {
        const { emoji } = req.body;
        
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const message = group.messages.id(req.params.messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (!message.reactions) {
            message.reactions = new Map();
        }

        const reactionUsers = message.reactions.get(emoji) || [];
        const userIndex = reactionUsers.indexOf(req.user._id);

        if (userIndex === -1) {
            reactionUsers.push(req.user._id);
        } else {
            reactionUsers.splice(userIndex, 1);
        }

        if (reactionUsers.length > 0) {
            message.reactions.set(emoji, reactionUsers);
        } else {
            message.reactions.delete(emoji);
        }

        await group.save();

        res.json({ reactions: message.reactions });
    } catch (error) {
        console.error('Error handling reaction:', error);
        res.status(500).json({ error: 'Failed to handle reaction' });
    }
});

// Mark messages as read
router.post('/:groupId/read', isLoggedIn, async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        await group.markAsRead(req.user._id);
        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Update group settings
router.put('/:groupId/settings', isLoggedIn, async (req, res) => {
    try {
        const { notifications, muteUntil } = req.body;
        
        const group = await Group.findOne({
            _id: req.params.groupId,
            members: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (!group.settings) {
            group.settings = {};
        }

        if (typeof notifications === 'boolean') {
            group.settings.notifications = notifications;
        }

        if (muteUntil) {
            group.settings.muteUntil = new Date(muteUntil);
        }

        await group.save();
        res.json(group.settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Update group description
router.put('/:groupId/description', isLoggedIn, async (req, res) => {
    try {
        const { description } = req.body;
        
        const group = await Group.findOne({
            _id: req.params.groupId,
            admin: req.user._id
        });

        if (!group) {
            return res.status(404).json({ error: 'Group not found or you are not the admin' });
        }

        group.description = description;
        await group.save();

        res.json({ description: group.description });
    } catch (error) {
        console.error('Error updating description:', error);
        res.status(500).json({ error: 'Failed to update description' });
    }
});

module.exports = router; 