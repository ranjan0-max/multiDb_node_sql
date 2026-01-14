const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const controllerName = 'task.controller';
const { extractPagination } = require('../Helpers/request.helper');
const sendNotification = require('../Helpers/notifications');
const { closeDateFilterHandler } = require('../Helpers/taskStats.helper');
const { dateValidator } = require('../Helpers/dateValidator.helper');
const { sendTemplateMessage } = require('../Services/whatsappMessage.service');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ADMIN_ROLE_ID, CLIENT_ROLE_ID, CLOSE_DATE_FILTERS } = require('../Constants/constant');

// create the department
const createTask = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const allowedFields = ['taskTitle', 'raisedTo', 'departmentId', 'categoryId', 'closeDate', 'taskBody', 'status', 'createdBy'];

    const filteredPayload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

    if (filteredPayload.closeDate) {
      filteredPayload.closeDate = new Date(req.body.closeDate);
    }

    filteredPayload.updatedAt = new Date();
    filteredPayload.createdAt = new Date();

    const attachments = req?.body?.attachments;

    const transactionTasks = await clientDb.$transaction(async (transaction) => {

      const task = await CrudHelper.create(transaction.task, filteredPayload);

      if (task) {
        const dataToUpdate = {
          taskNumber: 'WC-' + task?.id
        };
        await CrudHelper.updateOne(transaction.task, { id: task?.id }, dataToUpdate);
      }

      const attachmentData = [];

      if (attachments?.length) {
        for (let i = 0; i < attachments.length; i++) {
          attachmentData.push({
            taskId: task?.id,
            path: attachments?.[i]?.link
          });
        }
      }

      if (attachmentData?.length) {
        await CrudHelper.createMany(transaction.attachment, attachmentData);
      }

      return task;
    })

    const raisedToUser = await CrudHelper.read(prisma.user, { id: filteredPayload.raisedTo }, ['id', 'name', 'fcmToken', 'whatsAppNo']);
    const createdByUser = await CrudHelper.read(prisma.user, { id: filteredPayload.createdBy });

    if (raisedToUser?.fcmToken) {
      sendNotification(raisedToUser?.fcmToken, 'Task Created', 'Task Created By ' + createdByUser?.name);
    }

    if (raisedToUser?.whatsAppNo) {
      const templateParams = [
        raisedToUser?.name,
        transactionTasks?.taskTitle,
        createdByUser?.name,
        new Date(transactionTasks.closeDate).toLocaleDateString('en-GB')
      ];

      await sendTemplateMessage(`91${raisedToUser.whatsAppNo}`, 'ad9c9d07-a57f-4b7c-a7bd-3fd32a7477dd', templateParams);
    }

    // If the request originates from a custom flow (WhatsApp task creation), skip sending the default success response because that expects an Express res object, which is not available in that flow. So returning response from here.
    if (req.body.customRequest) {
      return;
    }

    return Response.success(res, {
      data: {},
      message: 'Task Created SuccessFully'
    });
  } catch (error) {
    console.log(error);
    Logger.error(error.message + ' at createTask function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// get department by different query parameters
const getTask = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const { limit, skip } = extractPagination(req);
    const sanitizedQuery = req.sanitizedQuery;
    let query = [];

    if ((req.query.user_role !== ADMIN_ROLE_ID && req.query.user_role !== CLIENT_ROLE_ID) || sanitizedQuery?.userId) {
      const userId = sanitizedQuery?.userId || req.query.auth_user_id;
      query.push({
        OR: [{ raisedTo: Number(userId) }, { createdBy: Number(userId) }]
      });
    }

    if (sanitizedQuery?.raisedTo) {
      query.push({ raisedTo: sanitizedQuery.raisedTo });
    }

    if (sanitizedQuery?.createdBy) {
      query.push({ createdBy: sanitizedQuery.createdBy });
    }

    if (sanitizedQuery?.status) {
      query.push({ status: sanitizedQuery.status });
    }

    if (sanitizedQuery?.mobileStatus) {
      const mobileStatus = sanitizedQuery.mobileStatus.split(',').map((s) => s.trim());
      query.push({ status: { in: mobileStatus } });
    }

    // handling closed date filter
    if (sanitizedQuery?.closedDate) {
      if (sanitizedQuery.closedDate === CLOSE_DATE_FILTERS.CUSTOM) {
        const dateError = dateValidator(sanitizedQuery);
        if (dateError) {
          return Response.badRequest(res, { message: dateError });
        }
      }

      const closeDateConditions = await closeDateFilterHandler(sanitizedQuery);
      query.push({ closeDate: closeDateConditions });
    }

    const users = await CrudHelper.findManyDetails(prisma.user, { client: { code: req.dbName } }, 'AND', ['id', 'name']);

    const searchValue = req?.query?.search;

    let matchedUserIds = [];
    if (searchValue) {
      matchedUserIds = users.filter((user) => user.name?.toLowerCase().includes(searchValue.toLowerCase())).map((user) => user.id);
    }

    if (searchValue && searchValue.trim !== '') {
      query.push({
        OR: [
          { taskTitle: { contains: searchValue } },
          { status: { contains: searchValue } },
          {
            Department: {
              name: {
                contains: searchValue
              }
            }
          },
          {
            Category: {
              name: {
                contains: searchValue
              }
            }
          }
        ]
      });
    }

    if (matchedUserIds.length > 0) {
      query[query.length - 1].OR.push({
        raisedTo: { in: matchedUserIds }
      });
    }

    sanitizedQuery.logical = sanitizedQuery.logical ? sanitizedQuery.logical : 'AND';

    const tasks = await CrudHelper.findManyDetails(
      clientDb.task,
      query,
      sanitizedQuery.logical,
      [],
      ['Department', 'Category'],
      [{ createdAt: 'desc' }],
      {
        skip,
        limit
      }
    );

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Process all tasks in parallel
    let response = await Promise.all(
      tasks.map(async (task) => {
        const attachments = await CrudHelper.findManyDetails(clientDb.attachment, { taskId: task.id });

        return {
          ...task,
          attachments: attachments.map((attachment) => attachment.path),
          raisedTo_name: userMap.get(task.raisedTo) || null,
          createdBy_name: userMap.get(task.createdBy) || null,
          closeDate: new Date(task.closeDate).toDateString()
        };
      })
    );

    let whereClause = {};
    if (Array.isArray(query) && query.length > 0) {
      whereClause = sanitizedQuery.logical === 'OR' ? { OR: query } : { AND: query };
    }
    let count = await CrudHelper.getCount(clientDb.task, whereClause);

    return Response.success(res, {
      data: response,
      count,
      message: 'Tasks Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getTask function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// update the department
const updateTask = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const { id } = req.params;

    if (!id) {
      return Response.badRequest(res, {
        message: 'Task Id is required'
      });
    }

    const attachments = req.body.attachments;

    const allowedFields = ['taskTitle', 'raisedTo', 'departmentId', 'categoryId', 'closeDate', 'taskBody', 'status'];

    const filteredPayload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

    if (filteredPayload.closeDate) {
      filteredPayload.closeDate = new Date(req.body.closeDate);
    }

    filteredPayload.updatedAt = new Date();

    const attachmentData = [];

    const updatedTasks = await clientDb.$transaction(async (transaction) => {

      if (attachments?.length) {
        for (let i = 0; i < attachments.length; i++) {
          attachmentData.push({
            taskId: Number(id),
            path: attachments?.[i]?.link
          });
        }
      } else if (req.body?.attachments && req.body.attachments.length === 0) {
        await CrudHelper.remove(transaction.attachment, { taskId: Number(id) });
        await CrudHelper.createMany(transaction.attachment, attachmentData);
      }

      if (attachmentData?.length) {
        await CrudHelper.remove(transaction.attachment, { taskId: Number(id) });
        await CrudHelper.createMany(transaction.attachment, attachmentData);
      }

      const updateTask = await CrudHelper.updateOne(transaction.task, { id: Number(id) }, filteredPayload);

      return updateTask;
    });

    if (filteredPayload?.status) {
      const raisedToUser = await CrudHelper.read(prisma.user, { id: Number(updatedTasks.raisedTo) }, ['id', 'name', 'fcmToken']);
      const createdByUser = await CrudHelper.read(prisma.user, { id: Number(updatedTasks.createdBy) }, ['id', 'name', 'fcmToken']);

      if (raisedToUser?.fcmToken) {
        sendNotification(raisedToUser?.fcmToken, 'Task Updated', 'Task Updated To ' + filteredPayload?.status);
      }

      if (createdByUser?.fcmToken) {
        sendNotification(createdByUser?.fcmToken, 'Task Updated', 'Task Updated To ' + filteredPayload?.status);
      }
    }

    return Response.success(res, {
      data: {},
      message: 'Task updated successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateTask function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

module.exports = {
  createTask,
  getTask,
  updateTask
};
