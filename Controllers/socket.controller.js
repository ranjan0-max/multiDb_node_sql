const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CrudHelper = require('../Helpers/crud.helper');

module.exports = (io) => {
  io.on('connection', (socket) => {
    // Join task room
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });

    // Typing indicator
    socket.on('typing', async ({ roomId, userId }) => {
      const user = await CrudHelper.read(prisma.user, { id: userId }, ['id', 'name']);
      socket.to(roomId).emit('userTyping', user);
    });

    // Stop typing indicator
    socket.on('stopTyping', async ({ roomId, userId }) => {
      const user = await CrudHelper.read(prisma.user, { id: userId }, ['id', 'name']);
      socket.to(roomId).emit('userStoppedTyping', user);
    });
  });
};
