const { createServer } = require('http');
const { Server } = require('socket.io');
const { testDatabaseConnection } = require('./Database/connection');

const app = require('./app');
const express = require('express');
const Logger = require('./Helpers/logger');
const { IST } = require('./Helpers/dateTime.helper');
const HandleError = require('./Middleware/errorHandler.middleware');
const path = require('path');

const server = createServer(app);

const { PORT, NODE_ENV } = process.env;

const io = new Server(server, {
  maxHttpBufferSize: 1024,
  pingInterval: 60 * 1000,
  pingTimeout: 60 * 4000,
  cors: {
    origins: process.env.CORS_URLS.split(', ')
  }
});

// call all crone
require('./cron');

const httpServer = server.listen(PORT || 1310, async (error) => {
  if (error) {
    Logger.error(error);
    process.exit(1);
  }
  try {
    testDatabaseConnection();
    console.log(`server started on port: [${PORT || 1310}] with [${NODE_ENV.toUpperCase()} --env] [${IST('date')} ${IST('time')}]`);
  } catch (connectionError) {
    console.log('Unable to connect --DATABASE, Killing app :/(', connectionError);
    Logger.error(connectionError?.stack);
    process.exit(1);
  }
});

app.use('/File', express.static(path.join(__dirname, 'File')));
//? routes
require('./Routes')();

//? error handler middleware
app.use(HandleError);

// socket
io.on('connection', (socket) => {
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

global.io = io;
