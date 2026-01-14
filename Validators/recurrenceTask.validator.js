const Joi = require('joi');

const recurrenceTaskValidator = Joi.object({
    taskTitle: Joi.string().required(),
    raisedTo: Joi.number().required(),
    departmentId: Joi.number(),
    categoryId: Joi.number(),
    closeDate: Joi.string(),
    taskBody: Joi.string(),
    frequency: Joi.string().required(),
    createdBy: Joi.number()
}).unknown(true);

module.exports = recurrenceTaskValidator;