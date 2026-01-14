const express = require('express');
const router = express.Router();

const { webhookwhatsapp } = require('../Controllers/whatsapp.controller');

router.post('/webhook', webhookwhatsapp);

module.exports = router;
