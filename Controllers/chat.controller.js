const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const controllerName = 'chat.controller';
const { getfileLinkFromServer } = require('../Helpers/uploadFileOnServer.helper');
const { generateUniqueId } = require('../Helpers/uniqueIdGenerator.helper');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// create room
const checkTaskRoomOrCreate = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    if (!req.query.task_id) {
      return Response.error(res, {
        message: 'Task Id is required'
      });
    }
    const taskId = Number(req.query.task_id);

    const chatRoomFound = await CrudHelper.read(clientDb.chatRoom, { taskId: taskId });
    if (chatRoomFound) {
      return Response.success(res, {
        data: chatRoomFound,
        message: 'Chat Room Found'
      });
    }
    const roomId = generateUniqueId(6, 'ROOM-');
    const newChatRoom = await CrudHelper.create(clientDb.chatRoom, { taskId: taskId, roomId: roomId + '-' + taskId });
    return Response.success(res, {
      data: newChatRoom,
      message: 'Chat Room Created'
    });
  } catch (error) {
    Logger.error(error.message + ' at checkTaskRoomOrCreate function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const getAllChatsByTask = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    if (!req.query.room_id) {
      return Response.error(res, {
        message: 'Room Id is required'
      });
    }

    const chats = await CrudHelper.findManyDetails(clientDb.chat, { roomId: req.query.room_id });

    const response = [];

    for (const chat of chats) {
      const user = await CrudHelper.read(prisma.user, { id: chat.userId }, ['id', 'name']);
      if (chat.type == 'document') {
        const fileLink = await getfileLinkFromServer(req, chat.message);
        response.push({
          ...chat,
          userName: user.name,
          document: fileLink
        });
      } else {
        response.push({
          ...chat,
          userName: user.name
        });
      }
    }

    return Response.success(res, {
      data: response,
      message: 'Chats Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getAllChatsByTask function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const createMessage = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const data = {
      type: req.body.type,
      message: req.body.message,
      userId: req.body.userId,
      roomId: req.body.roomId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await CrudHelper.create(clientDb.chat, data);

    let fileLink = null;
    if (req.body.type == 'document') {
      fileLink = await getfileLinkFromServer(req, req.body.message);
    }

    global.io.to(req.body.roomId).emit('receiveMessage', {
      message: req.body.message,
      sender: await CrudHelper.read(prisma.user, { id: req.body.userId }, ['id', 'name']),
      document: fileLink,
      timestamp: new Date()
    });

    return Response.success(res, {
      data: {},
      message: 'Message Created'
    });
  } catch (error) {
    Logger.error(error.message + ' at createMessage function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  checkTaskRoomOrCreate,
  getAllChatsByTask,
  createMessage
};
