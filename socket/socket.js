const User = require('../models/user');
const Group = require('../models/Group');
const { createNotification } = require('../utils/notifications');
const socketIO = require('socket.io');
const notificationModel = require('../models/notification');
const Chat = require('../models/chat');

let io;

const userSockets = new Map();

function initSocket(server) {
    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket'],
        path: '/socket.io',
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        allowUpgrades: true,
        cookie: false
    });

    io.on('connection', async (socket) => {
        try {
            console.log('New socket connection:', socket.id);
            
            // Get user ID from auth
            const userId = socket.handshake.auth.userId;
            
            if (!userId) {
                console.log('Socket connected without userId, waiting for authenticate event');
                socket.on('authenticate', async (authUserId) => {
                    console.log('Socket authenticated via event:', socket.id, 'for user:', authUserId);
                    if (authUserId) {
                        socket.userId = authUserId;
                        userSockets.set(authUserId, socket.id);
                        try {
                            await User.findByIdAndUpdate(authUserId, { isOnline: true });
                            socket.broadcast.emit('userOnline', { userId: authUserId });
                            socket.join(`user:${authUserId}`);
                        } catch (error) {
                            console.error('Error updating user online status:', error);
                        }
                    }
                });
            } else {
                console.log('Socket authenticated via handshake:', socket.id, 'for user:', userId);
                socket.userId = userId;
                userSockets.set(userId, socket.id);
                try {
                    await User.findByIdAndUpdate(userId, { isOnline: true });
                    socket.broadcast.emit('userOnline', { userId: userId });
                    socket.join(`user:${userId}`);
                } catch (error) {
                    console.error('Error updating user online status:', error);
                }
            }

            // Join private chat room
            socket.on('joinChat', (chatId) => {
                socket.join(`chat_${chatId}`);
                console.log(`User ${socket.userId} joined chat room: chat_${chatId}`);
            });

            // Join user's notification room
            socket.on('joinRoom', (room) => {
                socket.join(room);
                console.log(`User ${socket.userId} joined room: ${room}`);
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

            // Handle direct chat messages
            socket.on('chatMessage', async (data) => {
                try {
                    const { chatId, message, receiverId } = data;
                    console.log(`Received chatMessage in room chat_${chatId}`, message);
                    
                    // Save message to database
                    const chat = await Chat.findById(chatId);
                    if (!chat) {
                        console.error('Chat not found:', chatId);
                        return;
                    }
                    
                    // Add message to chat
                    chat.messages.push(message);
                    chat.lastMessage = message;
                    await chat.save();
                    
                    // Populate sender details
                    await chat.populate('messages.sender', 'name username profileImage');
                    
                    // Get the newly added message
                    const populatedMessage = chat.messages[chat.messages.length - 1];
                    
                    // Emit to chat room
                    io.to(`chat_${chatId}`).emit('newMessage', {
                        chatId: chatId,
                        message: populatedMessage
                    });
                    
                    // Also send directly to recipient for extra reliability
                    if (receiverId && userSockets.has(receiverId)) {
                        console.log(`Sending direct message to recipient ${receiverId}`);
                        io.to(userSockets.get(receiverId)).emit('newMessage', {
                            chatId: chatId,
                            message: populatedMessage
                        });
                    }
                } catch (error) {
                    console.error('Error handling chat message:', error);
                }
            });

            // Handle message read status
            socket.on('markAsRead', async (data) => {
                try {
                    const { messageId } = data;
                    
                    // Find the chat containing this message
                    const chat = await Chat.findOne({
                        'messages._id': messageId
                    });
                    
                    if (!chat) {
                        console.error('Chat not found for message:', messageId);
                        return;
                    }
                    
                    // Update message read status
                    const message = chat.messages.id(messageId);
                    if (message) {
                        message.read = true;
                        await chat.save();
                        
                        // Notify sender that message was read
                        const senderSocket = userSockets.get(message.sender.toString());
                        if (senderSocket) {
                            io.to(senderSocket).emit('messageRead', {
                                messageId: messageId,
                                chatId: chat._id
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error marking message as read:', error);
                }
            });

            socket.on('disconnect', async () => {
                if (socket.userId) {
                    userSockets.delete(socket.userId);
                    try {
                        await User.findByIdAndUpdate(socket.userId, { isOnline: false });
                        socket.broadcast.emit('userOffline', { userId: socket.userId });
                    } catch (error) {
                        console.error('Error updating user offline status:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Socket connection error:', error);
        }
    });

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