const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const User = require('../models/user');
const Notification = require('../models/notification');
const { createNotification } = require('../utils/notifications');
const { isLoggedIn } = require('../index.js');

// Get all projects
router.get('/', async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('admin', 'name email profileImage')
            .populate('participants', 'name email profileImage')
            .populate('joinRequests.user', 'name email profileImage')
            .sort({ createdAt: -1 });
        res.json({ projects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Error fetching projects' });
    }
});

// Create a new project
router.post('/', async (req, res) => {
    try {
        const { title, description, type, maxParticipants, techStack, githubLink, startDate } = req.body;
        
        // Validate required fields
        if (!title || !description || !type || !maxParticipants || !techStack) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate project type
        if (!['ongoing', 'upcoming'].includes(type)) {
            return res.status(400).json({ message: 'Invalid project type' });
        }

        // Validate start date for upcoming projects
        if (type === 'upcoming' && !startDate) {
            return res.status(400).json({ message: 'Start date is required for upcoming projects' });
        }

        // Create project
        const project = new Project({
            title,
            description,
            type,
            maxParticipants,
            techStack: Array.isArray(techStack) ? techStack : techStack.split(',').map(tech => tech.trim()),
            githubLink,
            startDate: type === 'upcoming' ? startDate : new Date(),
            admin: req.user._id,
            participants: [req.user._id]
        });

        await project.save();
        res.status(201).json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Error creating project' });
    }
});

// Send join request
router.post('/:projectId/join-request', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId)
            .populate('admin', 'name email profileImage')
            .populate('participants', 'name email profileImage');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is already a participant
        if (project.participants.some(p => p._id.toString() === req.user._id.toString())) {
            return res.status(400).json({ message: 'You are already a participant' });
        }

        // Check if project is full
        if (project.participants.length >= project.maxParticipants) {
            return res.status(400).json({ message: 'Project is full' });
        }

        // Check if user already has a pending request
        const existingRequest = project.joinRequests.find(
            request => request.user.toString() === req.user._id.toString() && request.status === 'pending'
        );

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending request' });
        }

        // Add join request
        project.joinRequests.push({
            user: req.user._id,
            status: 'pending',
            message: req.body.message || 'I would like to join this project'
        });

        await project.save();

        // Create notification for project admin
        await createNotification({
            recipient: project.admin._id,
            type: 'project_join_request',
            title: 'New Project Join Request',
            message: `${req.user.name} wants to join your project "${project.title}"`,
            data: {
                projectId: project._id,
                requestId: project.joinRequests[project.joinRequests.length - 1]._id
            }
        });

        res.json({ message: 'Join request sent successfully' });
    } catch (error) {
        console.error('Error sending join request:', error);
        res.status(500).json({ message: 'Error sending join request' });
    }
});

// Handle join request (accept/reject)
router.put('/:projectId/join-request/:requestId', async (req, res) => {
    try {
        const { status } = req.body;
        const project = await Project.findById(req.params.projectId)
            .populate('admin', 'name email profileImage')
            .populate('participants', 'name email profileImage')
            .populate('joinRequests.user', 'name email profileImage');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is project admin
        if (project.admin._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only project admin can handle join requests' });
        }

        const request = project.joinRequests.id(req.params.requestId);
        if (!request) {
            return res.status(404).json({ message: 'Join request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'This request has already been handled' });
        }

        // Update request status
        request.status = status;
        request.respondedAt = new Date();

        if (status === 'accepted') {
            // Check if project is still not full
            if (project.participants.length >= project.maxParticipants) {
                return res.status(400).json({ message: 'Project is now full' });
            }

            // Add user to participants
            project.participants.push(request.user._id);

            // Create notification for accepted user
            await createNotification({
                recipient: request.user._id,
                type: 'project_join_accepted',
                title: 'Project Join Request Accepted',
                message: `Your request to join "${project.title}" has been accepted`,
                data: {
                    projectId: project._id
                }
            });
        } else {
            // Create notification for rejected user
            await createNotification({
                recipient: request.user._id,
                type: 'project_join_rejected',
                title: 'Project Join Request Rejected',
                message: `Your request to join "${project.title}" has been rejected`,
                data: {
                    projectId: project._id
                }
            });
        }

        await project.save();
        res.json({ message: `Join request ${status} successfully` });
    } catch (error) {
        console.error('Error handling join request:', error);
        res.status(500).json({ message: 'Error handling join request' });
    }
});

// Get project details
router.get('/:projectId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId)
            .populate('admin', 'name email profileImage')
            .populate('participants', 'name email profileImage')
            .populate('joinRequests.user', 'name email profileImage');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Error fetching project' });
    }
});

// Update project
router.put('/:projectId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is project admin
        if (project.admin.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only project admin can update project' });
        }

        const { title, description, type, maxParticipants, techStack, githubLink, startDate } = req.body;

        // Update fields
        if (title) project.title = title;
        if (description) project.description = description;
        if (type) project.type = type;
        if (maxParticipants) project.maxParticipants = maxParticipants;
        if (techStack) project.techStack = Array.isArray(techStack) ? techStack : techStack.split(',').map(tech => tech.trim());
        if (githubLink !== undefined) project.githubLink = githubLink;
        if (startDate) project.startDate = startDate;

        await project.save();
        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Error updating project' });
    }
});

// Delete project
router.delete('/:projectId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is project admin
        if (project.admin.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only project admin can delete project' });
        }

        await project.remove();
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project' });
    }
});

module.exports = router; 





