const express = require('express');
const ChatController = require('../Controllers/chat.controller');
const router = express.Router();
const { authJwt } = require('../Middleware/apiAuth.middleware');
const dynamicDbConnectionMiddleware = require('../Middleware/getDynamicConnection.middleware');

router
  .post('/', authJwt, dynamicDbConnectionMiddleware, ChatController.createMessage)
  .get('/', authJwt, dynamicDbConnectionMiddleware, ChatController.getAllChatsByTask)
  .get('/checkTaskRoom', authJwt, dynamicDbConnectionMiddleware, ChatController.checkTaskRoomOrCreate);

module.exports = router;
