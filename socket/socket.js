const User = require('../models/User');
const Group = require('../models/Group');
const { createNotification } = require('../utils/notifications');

let io;

const userSockets = new Map();

function initSocket(server) {
    io = require('socket.io')(server);

    io.on('connection', async (socket) => {
        try {
            const userId = socket.handshake.auth.userId;
            if (userId) {
                userSockets.set(userId, socket.id);
                await User.findByIdAndUpdate(userId, { isOnline: true });
                socket.broadcast.emit('userOnline', { userId });
            }

            // Join private chat room
            socket.on('joinChat', (chatId) => {
                socket.join(`chat_${chatId}`);
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
                const { chatId, isTyping } = data;
                socket.to(`chat_${chatId}`).emit('typing', {
                    userId,
                    isTyping
                });
            });

            // Handle group typing indicators
            socket.on('groupTyping', (data) => {
                const { groupId, isTyping } = data;
                socket.to(`group_${groupId}`).emit('groupTyping', {
                    userId,
                    isTyping
                });
            });

            socket.on('disconnect', async () => {
                if (userId) {
                    userSockets.delete(userId);
                    await User.findByIdAndUpdate(userId, { isOnline: false });
                    socket.broadcast.emit('userOffline', { userId });
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

module.exports = {
    initSocket,
    getIO
}; 