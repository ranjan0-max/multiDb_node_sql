const express = require("express");
const LogsController = require("../Controllers/logs.controller");
const router = express.Router();

const { authJwt } = require("../Middleware/apiAuth.middleware");

router.get("/files", authJwt, LogsController.getAllLogsFileNames);
router.get("/detail", authJwt, LogsController.getLogFileDetail);

module.exports = router;
