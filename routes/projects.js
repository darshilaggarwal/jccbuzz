const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const userModel = require('../models/user');
const { createNotification } = require('../utils/notifications');

// Get all projects
router.get('/', async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('admin', 'name username profileImage')
            .populate('participants', 'name username profileImage')
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
        const {
            title,
            type,
            startDate,
            description,
            techStack,
            githubLink,
            maxParticipants
        } = req.body;

        // Log the request data for debugging
        console.log('Project creation request:', {
            title,
            type,
            startDate,
            description,
            techStack,
            githubLink,
            maxParticipants,
            user: req.user
        });

        // Validate required fields
        if (!title || !description || !techStack || !maxParticipants) {
            return res.status(400).json({ 
                message: 'Missing required fields',
                details: {
                    title: !title,
                    description: !description,
                    techStack: !techStack,
                    maxParticipants: !maxParticipants
                }
            });
        }

        // Validate project type
        if (!['ongoing', 'upcoming'].includes(type)) {
            return res.status(400).json({ message: 'Invalid project type. Must be either "ongoing" or "upcoming"' });
        }

        // Validate start date for upcoming projects
        if (type === 'upcoming') {
            if (!startDate) {
                return res.status(400).json({ message: 'Start date is required for upcoming projects' });
            }
            const startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
                return res.status(400).json({ message: 'Invalid start date format' });
            }
            if (startDateObj < new Date()) {
                return res.status(400).json({ message: 'Start date must be in the future for upcoming projects' });
            }
        }

        // Validate max participants
        if (maxParticipants < 1) {
            return res.status(400).json({ message: 'Maximum participants must be at least 1' });
        }

        // Get the user from the database using email
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            console.error('User not found in database:', req.user.email);
            return res.status(401).json({ message: 'User not found' });
        }

        // Create the project
        const project = new Project({
            title,
            type,
            startDate: type === 'upcoming' ? startDate : null,
            description,
            techStack: Array.isArray(techStack) ? techStack : techStack.split(',').map(tech => tech.trim()),
            githubLink: githubLink || '',
            maxParticipants,
            admin: user._id,
            participants: [user._id]
        });

        // Validate the project before saving
        const validationError = project.validateSync();
        if (validationError) {
            console.error('Project validation error:', validationError);
            return res.status(400).json({ 
                message: 'Project validation failed',
                details: validationError.errors
            });
        }

        // Save the project
        await project.save();
        console.log('Project created successfully:', project._id);

        // Populate the response with user details
        const populatedProject = await Project.findById(project._id)
            .populate('admin', 'name username profileImage')
            .populate('participants', 'name username profileImage');

        res.status(201).json(populatedProject);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ 
            message: 'Error creating project',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Request to join a project
router.post('/:projectId/join-request', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is already a participant
        if (project.participants.includes(req.user._id)) {
            return res.status(400).json({ message: 'You are already a participant in this project' });
        }

        // Check if user has already sent a request
        const existingRequest = project.joinRequests.find(
            request => request.user.equals(req.user._id) && request.status === 'pending'
        );
        if (existingRequest) {
            return res.status(400).json({ message: 'You have already sent a join request' });
        }

        if (!project.canJoin(req.user._id)) {
            return res.status(400).json({ message: 'Cannot join this project' });
        }

        // Add join request
        project.joinRequests.push({
            user: req.user._id,
            status: 'pending'
        });

        await project.save();

        // Create notification for project admin
        await createNotification({
            recipient: project.admin,
            sender: req.user._id,
            type: 'project_join_request',
            text: 'requested to join your project',
            project: project._id
        });

        res.json({ message: 'Join request sent successfully' });
    } catch (error) {
        console.error('Error sending join request:', error);
        res.status(500).json({ message: 'Error sending join request' });
    }
});

// Handle join request (accept/reject)
router.post('/:projectId/join-request/:requestId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is project admin
        if (!project.admin.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to handle join requests' });
        }

        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const request = project.joinRequests.id(req.params.requestId);
        if (!request) {
            return res.status(404).json({ message: 'Join request not found' });
        }

        const success = project.handleJoinRequest(request.user, status);
        if (!success) {
            return res.status(400).json({ message: 'Failed to handle join request' });
        }

        await project.save();

        // Create notification for the user who requested to join
        await createNotification({
            recipient: request.user,
            sender: req.user._id,
            type: status === 'accepted' ? 'project_join_accepted' : 'project_join_rejected',
            text: status === 'accepted' ? 'accepted your request to join their project' : 'rejected your request to join their project',
            project: project._id
        });

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
            .populate('admin', 'name username profileImage')
            .populate('participants', 'name username profileImage')
            .populate('joinRequests.user', 'name username profileImage');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project details:', error);
        res.status(500).json({ message: 'Error fetching project details' });
    }
});

// Update project details
router.put('/:projectId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is project admin
        if (!project.admin.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to update project' });
        }

        const updates = req.body;
        Object.keys(updates).forEach(key => {
            if (key !== 'admin' && key !== 'participants' && key !== 'joinRequests') {
                project[key] = updates[key];
            }
        });

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
        if (!project.admin.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to delete project' });
        }

        await project.remove();
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project' });
    }
});

module.exports = router; 




