const Joi = require('joi');

const taskValidator = Joi.object({
  taskTitle: Joi.string().required(),
  raisedTo: Joi.number().required(),
  departmentId: Joi.number(),
  closeDate: Joi.string().required(),
  categoryId: Joi.number(),
  closeDate: Joi.string(),
  taskBody: Joi.string(),
  createdBy: Joi.number()
}).unknown(true);

module.exports = taskValidator;
