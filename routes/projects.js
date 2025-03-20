const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const userModel = require('../models/user');
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

// Get join requests for current user
router.get('/join-requests', async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Find all projects where the user has a join request
        const projects = await Project.find({
            'joinRequests.user': userId
        })
        .populate('admin', 'name email profileImage')
        .select('title description joinRequests')
        .sort({ createdAt: -1 });
        
        // Extract just the join requests for this user
        const joinRequests = projects.map(project => {
            const request = project.joinRequests.find(
                req => req.user.toString() === userId.toString()
            );
            
            return {
                projectId: project._id,
                projectTitle: project.title,
                projectAdmin: project.admin,
                status: request.status,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt,
                message: request.message
            };
        });
        
        res.json({ joinRequests });
    } catch (error) {
        console.error('Error fetching join requests:', error);
        res.status(500).json({ message: 'Error fetching join requests' });
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

// Submit a join request
router.post('/:projectId/join-request', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { message } = req.body;
        const userId = req.user._id;

        console.log('Received join request:', { projectId, message, userId });

        // Find the project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if the user is already a participant
        if (project.participants.includes(userId)) {
            return res.status(400).json({ message: 'You are already a participant in this project' });
        }

        // Check if the user already has a pending join request
        const existingRequest = project.joinRequests.find(
            request => request.user.toString() === userId.toString() && request.status === 'pending'
        );

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending join request' });
        }

        // Add the join request without modifying the project model
        const joinRequest = {
            user: userId,
            message: message || 'I would like to join this project',
            status: 'pending',
            createdAt: new Date()
        };
        
        project.joinRequests.push(joinRequest);

        // Make sure we don't trigger validation on the startDate field
        const saveOptions = { validateModifiedOnly: true };
        await project.save(saveOptions);

        // Get the user's name for the notification
        const user = await userModel.findById(userId);
        const userName = user ? user.name : 'Someone';

        try {
            // Send notification to project admin
            await createNotification({
                recipient: project.admin,
                sender: userId,
                type: 'project_join_request',
                title: 'New Join Request',
                message: `${userName} wants to join your project "${project.title}"`,
                data: {
                    projectId: project._id
                }
            });
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
            // Continue even if notification fails
        }

        return res.status(201).json({ 
            message: 'Join request submitted successfully',
            requestId: project.joinRequests[project.joinRequests.length - 1]._id
        });
    } catch (error) {
        console.error('Error submitting join request:', error);
        return res.status(500).json({ message: 'Error submitting join request. Please try again.' });
    }
});

// Handle join request (accept/reject)
router.put('/:projectId/join-request/:requestId', async (req, res) => {
    try {
        const { projectId, requestId } = req.params;
        const { status } = req.body;
        const userId = req.user._id;

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Find the project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if the user is the admin
        if (project.admin.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Only the project admin can handle join requests' });
        }

        // Find the join request
        const joinRequestIndex = project.joinRequests.findIndex(
            request => request._id.toString() === requestId
        );

        if (joinRequestIndex === -1) {
            return res.status(404).json({ message: 'Join request not found' });
        }

        const joinRequest = project.joinRequests[joinRequestIndex];
        
        // Update the join request status
        project.joinRequests[joinRequestIndex].status = status;
        project.joinRequests[joinRequestIndex].updatedAt = new Date();

        // If accepted, add the user to participants
        if (status === 'accepted') {
            if (!project.participants.includes(joinRequest.user)) {
                project.participants.push(joinRequest.user);
            }
        }

        await project.save();

        // Send notification to the requestor
        await createNotification({
            recipient: joinRequest.user,
            sender: userId,
            type: status === 'accepted' ? 'project_join_accepted' : 'project_join_rejected',
            title: status === 'accepted' ? 'Join Request Accepted' : 'Join Request Rejected',
            message: status === 'accepted' 
                ? `Your request to join "${project.title}" has been accepted!` 
                : `Your request to join "${project.title}" has been rejected.`,
            data: {
                projectId: project._id
            }
        });

        res.json({ 
            message: `Join request ${status}`,
            project: await Project.findById(projectId)
                .populate('admin', 'name email profileImage')
                .populate('participants', 'name email profileImage')
                .populate('joinRequests.user', 'name email profileImage')
        });
    } catch (error) {
        console.error('Error handling join request:', error);
        return res.status(500).json({ message: 'Error handling join request' });
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





