const router = require('express').Router();
const User = require('../../models/user');

// Get user followers
// GET /api/users/:userId/followers
router.get('/:userId/followers', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('followers', 'username name profileImage');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user.followers);
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user following
// GET /api/users/:userId/following
router.get('/:userId/following', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('following', 'username name profileImage');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user.following);
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 