const User = require('../models/user');
const Group = require('../models/Group');
const { createNotification } = require('../utils/notifications');
const socketIO = require('socket.io');
const notificationModel = require('../models/notification');

let io;

const userSockets = new Map();

function initSocket(server) {
    io = socketIO(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', async (socket) => {
        try {
            const userIdData = socket.handshake.auth.userId;
            // Extract the actual ID, whether it comes as string or object
            const userId = typeof userIdData === 'object' && userIdData.userId ? userIdData.userId : userIdData;
            
            if (userId) {
                userSockets.set(userId, socket.id);
                try {
                    await User.findByIdAndUpdate(userId, { isOnline: true });
                    
                    // Broadcast to all clients about this user's online status
                    // Use a consistent object format with userId property
                    socket.broadcast.emit('userOnline', { userId: userId });
                    
                    // Automatically join user's own notification room
                    socket.join(`user:${userId}`);
                    console.log(`User ${userId} joined notification room: user:${userId}`);
                } catch (error) {
                    console.error('Error updating user online status:', error);
                }
            }

            // Join private chat room
            socket.on('joinChat', (chatId) => {
                socket.join(`chat_${chatId}`);
            });

            // Join user's notification room
            socket.on('joinRoom', (room) => {
                socket.join(room);
                console.log(`User ${userId} joined room: ${room}`);
            });

            // Leave private chat room
            socket.on('leaveChat', (chatId) => {
                socket.leave(`chat_${chatId}`);
            });

            // Join group chat room
            socket.on('joinGroup', (groupId) => {
                socket.join(`group_${groupId}`);
            });

            // Leave group chat room
            socket.on('leaveGroup', (groupId) => {
                socket.leave(`group_${groupId}`);
            });

            // Handle private messages
            socket.on('privateMessage', async (data) => {
                try {
                    const { recipientId, message } = data;
                    const recipientSocket = userSockets.get(recipientId);

                    // Save message to database
                    // ... existing private message handling code ...

                    // Emit to recipient if online
                    if (recipientSocket) {
                        io.to(recipientSocket).emit('privateMessage', {
                            senderId: userId,
                            message
                        });
                    }

                    // Create notification for offline users
                    if (!recipientSocket) {
                        await createNotification({
                            recipient: recipientId,
                            sender: userId,
                            type: 'message',
                            title: 'New Message',
                            message: 'You have a new private message',
                            data: { chatId: userId }
                        });
                    }
                } catch (error) {
                    console.error('Error handling private message:', error);
                }
            });

            // Handle group messages
            socket.on('groupMessage', async (data) => {
                try {
                    const { groupId, content } = data;
                    
                    // Save message to database
                    const group = await Group.findById(groupId);
                    if (!group) return;

                    const message = {
                        sender: userId,
                        content,
                        timestamp: new Date()
                    };

                    group.messages.push(message);
                    group.lastMessage = {
                        content,
                        sender: userId,
                        timestamp: new Date()
                    };

                    await group.save();

                    // Populate sender details
                    const populatedMessage = await Group.populate(message, {
                        path: 'sender',
                        select: 'name email profileImage'
                    });

                    // Emit to all members in the group
                    io.to(`group_${groupId}`).emit('groupMessage', {
                        groupId,
                        ...populatedMessage
                    });

                    // Create notifications for offline members
                    const offlineMembers = group.members.filter(memberId => 
                        memberId.toString() !== userId.toString() && 
                        !userSockets.has(memberId.toString())
                    );

                    for (const memberId of offlineMembers) {
                        await createNotification({
                            recipient: memberId,
                            sender: userId,
                            type: 'group_message',
                            title: 'New Group Message',
                            message: `New message in group "${group.name}"`,
                            data: { groupId }
                        });
                    }
                } catch (error) {
                    console.error('Error handling group message:', error);
                }
            });

            // Handle typing indicators
            socket.on('typing', (data) => {
                const { receiverId, chatId, userId } = data;
                console.log('Server received typing event:', data);
                
                // First, emit to the chat room
                socket.to(`chat_${chatId}`).emit('userTyping', {
                    userId: userId || socket.userId,
                    chatId: chatId,
                    timestamp: Date.now()
                });
                console.log(`Emitted 'userTyping' to chat room: chat_${chatId}`);
                
                // Also emit directly to the recipient for better reliability
                if (receiverId && userSockets.has(receiverId)) {
                    io.to(userSockets.get(receiverId)).emit('userTyping', {
                        userId: userId || socket.userId, 
                        chatId: chatId,
                        timestamp: Date.now()
                    });
                    console.log(`Emitted 'userTyping' directly to user: ${receiverId}`);
                } else if (receiverId) {
                    console.log(`Recipient ${receiverId} is not online or doesn't have an active socket`);
                }
            });

            // Handle voice recording status indicators
            socket.on('recordingVoice', (data) => {
                const { receiverId, chatId, userId, isRecording } = data;
                console.log('Server received recording voice event:', data);
                
                // First, emit to the chat room
                socket.to(`chat_${chatId}`).emit('userRecordingVoice', {
                    userId: userId || socket.userId,
                    chatId: chatId,
                    isRecording: isRecording,
                    timestamp: Date.now()
                });
                console.log(`Emitted 'userRecordingVoice' to chat room: chat_${chatId}`);
                
                // Also emit directly to the recipient for better reliability
                if (receiverId && userSockets.has(receiverId)) {
                    io.to(userSockets.get(receiverId)).emit('userRecordingVoice', {
                        userId: userId || socket.userId, 
                        chatId: chatId,
                        isRecording: isRecording,
                        timestamp: Date.now()
                    });
                    console.log(`Emitted 'userRecordingVoice' directly to user: ${receiverId}`);
                } else if (receiverId) {
                    console.log(`Recipient ${receiverId} is not online or doesn't have an active socket`);
                }
            });

            // Handle group typing indicators
            socket.on('groupTyping', (data) => {
                const { groupId, isTyping } = data;
                socket.to(`group_${groupId}`).emit('groupTyping', {
                    userId,
                    isTyping
                });
            });

            // Handle real-time notifications
            socket.on('notification', async (notification) => {
                try {
                    // Send to specific recipient
                    if (notification.recipient && userSockets.has(notification.recipient)) {
                        io.to(userSockets.get(notification.recipient)).emit('notification', notification);
                    }
                } catch (error) {
                    console.error('Error handling notification socket event:', error);
                }
            });

            // Handle new post notifications
            socket.on('newPostNotification', async (data) => {
                try {
                    const { senderId, followers, postId } = data;
                    
                    // Get sender information for better notifications
                    const sender = await User.findById(senderId).select('name username profileImage');
                    
                    // Emit to all online followers
                    for (const followerId of followers) {
                        if (userSockets.has(followerId)) {
                            io.to(userSockets.get(followerId)).emit('new_notification', {
                                type: 'new_post',
                                sender,
                                title: 'New Post',
                                message: `${sender?.name || 'Someone you follow'} shared a new post`,
                                data: { postId },
                                createdAt: new Date()
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error handling new post notification:', error);
                }
            });

            // Handle direct chat messages (for real-time delivery)
            socket.on('chatMessage', (data) => {
                try {
                    const { chatId, message, receiverId } = data;
                    console.log(`Received chatMessage in room chat_${chatId}`, message);
                    
                    // Broadcast to everyone in the chat room except sender
                    socket.to(`chat_${chatId}`).emit('newMessage', {
                        chatId: chatId,
                        message: message
                    });
                    
                    // Also send directly to recipient for extra reliability
                    if (receiverId && userSockets.has(receiverId)) {
                        console.log(`Sending direct message to recipient ${receiverId}`);
                        io.to(userSockets.get(receiverId)).emit('newMessage', {
                            chatId: chatId,
                            message: message
                        });
                    }
                } catch (error) {
                    console.error('Error handling chat message:', error);
                }
            });

            // Add handler for checking online status of other users
            socket.on('checkOnlineStatus', async (data) => {
                try {
                    const { userId } = data;
                    if (userId) {
                        console.log(`Checking online status for user: ${userId}`);
                        
                        // Check if user has an active socket connection first
                        const socketOnline = userSockets.has(userId.toString());
                        
                        // Only query database if socket check fails
                        let dbOnline = false;
                        if (!socketOnline) {
                            const user = await User.findById(userId).select('isOnline lastActive');
                            dbOnline = user && user.isOnline;
                        }
                        
                        // Prioritize socket connection over database value
                        // A user is considered online if they have an active socket
                        const isOnline = socketOnline;
                        
                        console.log(`Online status check for ${userId}: socketOnline=${socketOnline}, dbOnline=${dbOnline}, final=${isOnline}`);
                        
                        // Send status back only to the requesting socket
                        socket.emit('userOnlineStatus', {
                            userId: userId,
                            isOnline: isOnline
                        });
                    }
                } catch (error) {
                    console.error('Error checking online status:', error);
                    // Send a default response even on error
                    socket.emit('userOnlineStatus', {
                        userId: userId,
                        isOnline: false,
                        error: true
                    });
                }
            });

            socket.on('disconnect', async () => {
                if (userId) {
                    // Remove from active socket tracking
                    userSockets.delete(userId);
                    
                    // Wait a brief period before marking user as offline
                    // This helps prevent flickering if user is just refreshing the page
                    setTimeout(async () => {
                        // Check if the user has reconnected in the meantime
                        if (!userSockets.has(userId)) {
                            try {
                                await User.findByIdAndUpdate(userId, { isOnline: false });
                                
                                // Broadcast offline status with consistent object format
                                socket.broadcast.emit('userOffline', { userId: userId });
                                console.log(`User ${userId} marked as offline after disconnect`);
                            } catch (error) {
                                console.error('Error updating user offline status:', error);
                            }
                        }
                    }, 5000); // Wait 5 seconds before marking as offline
                }
            });
        } catch (error) {
            console.error('Socket connection error:', error);
        }
    });

    // Store the io instance globally
    global.io = io;

    return io;
}

function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}

// Function to send a notification to a specific user
const sendNotification = async (recipientId, notification) => {
    try {
        if (io && recipientId) {
            const recipientSocket = userSockets.get(recipientId.toString());
            
            // If recipient is online (has an active socket), send to their socket
            if (recipientSocket) {
                io.to(recipientSocket).emit('new_notification', notification);
            }
            
            // Also emit to user room for when they reconnect
            io.to(`user:${recipientId.toString()}`).emit('new_notification', notification);
        }
    } catch (error) {
        console.error('Error sending notification via socket:', error);
    }
};

// Helper function to send all types of notifications
const sendRealTimeNotification = async (notificationData) => {
    try {
        // Format the notification for real-time display
        const { recipient, type, title, message, data } = notificationData;
        
        // Store in database
        const newNotification = await notificationModel.create(notificationData);
        
        // Populate sender info for real-time display
        if (newNotification.sender) {
            await newNotification.populate('sender', 'name username profileImage');
        }
        
        // Send to recipient via socket
        sendNotification(recipient, newNotification);
        
        return newNotification;
    } catch (error) {
        console.error('Error sending real-time notification:', error);
        throw error;
    }
};

module.exports = {
    initSocket,
    getIO,
    sendNotification,
    sendRealTimeNotification
}; 