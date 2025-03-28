// Share post to chat
router.post('/share', isLoggedIn, async (req, res) => {
    try {
        const { postId, recipientId } = req.body;
        
        if (!postId || !recipientId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get post data
        const post = await Post.findById(postId)
            .populate('user', 'username name profileImage')
            .populate('image')
            .lean();
            
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Find or create chat between current user and recipient
        let chat = await Chat.findOne({
            participants: { 
                $all: [req.user._id, recipientId],
                $size: 2
            }
        });
        
        if (!chat) {
            chat = new Chat({
                participants: [req.user._id, recipientId],
                messages: []
            });
        }
        
        // Create new message with shared post
        const message = {
            sender: req.user._id,
            content: 'Shared a post',
            mediaType: 'none',
            isPostShare: true,
            sharedPost: postId,
            sharedPostPreview: {
                title: post.user.username,
                content: post.caption || '',
                image: post.image ? post.image.url : '',
                postId: post._id
            },
            read: false
        };
        
        // Add message to chat
        chat.messages.push(message);
        await chat.save();
        
        // Get the newly created message to return to client
        const newMessage = chat.messages[chat.messages.length - 1];
        
        // Populate sender details for the response
        const populatedMessage = await Chat.populate(newMessage, {
            path: 'sender',
            select: 'username name profileImage'
        });
        
        // Emit socket event if available
        if (req.io) {
            req.io.to(recipientId).emit('newMessage', {
                chatId: chat._id,
                message: populatedMessage
            });
        }
        
        return res.status(200).json({
            success: true,
            message: populatedMessage
        });
    } catch (error) {
        console.error('Error sharing post:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}); 