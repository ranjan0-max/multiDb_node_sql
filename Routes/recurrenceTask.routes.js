const express = require('express');
const RecurrenceTaskController = require('../Controllers/recurrenceTask.controller');
const router = express.Router();
const { authJwt } = require('../Middleware/apiAuth.middleware');
const dynamicDbConnectionMiddleware = require('../Middleware/getDynamicConnection.middleware');
const Validator = require('../Middleware/validator.middleware');
const recurrenceTaskValidator = require('../Validators/recurrenceTask.validator');

// sanatizedQuery
const sanitizedQuery = require('../Helpers/sanitizedQuery.helper');
const recurrenceTaskConfig = require('../controllerConfig/recurrenceTask.config');

router
    .post('/', authJwt, dynamicDbConnectionMiddleware, Validator(recurrenceTaskValidator), RecurrenceTaskController.createRecurrenceTask)
    .get('/', authJwt, dynamicDbConnectionMiddleware, sanitizedQuery(recurrenceTaskConfig), RecurrenceTaskController.getRecurrenceTask)
    .put('/:id', authJwt, dynamicDbConnectionMiddleware, RecurrenceTaskController.updateRecurrenceTask);

module.exports = router;