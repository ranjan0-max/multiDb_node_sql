const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const controllerName = 'recurrence-task.controller';
const { extractPagination } = require('../Helpers/request.helper');
const sendNotification = require('../Helpers/notifications');
const { closeDateFilterHandler } = require('../Helpers/taskStats.helper');
const { dateValidator } = require('../Helpers/dateValidator.helper');
const { calculateNextRunDate, calculateCloseDate } = require("../Helpers/dateTime.helper");
const { sendTemplateMessage } = require('../Services/whatsappMessage.service');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ADMIN_ROLE_ID, CLIENT_ROLE_ID, CLOSE_DATE_FILTERS } = require('../Constants/constant');

// create the recurrence task
const createRecurrenceTask = async (req, res) => {
    const clientDb = req.dbConnection;

    try {
        const allowedFields = ['taskTitle', 'raisedTo', 'departmentId', 'categoryId', 'closeDate', 'taskBody', 'status', 'createdBy', 'frequency', 'isScheduleActive'];

        const filteredPayload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

        filteredPayload.nextRunAt = calculateNextRunDate(filteredPayload.frequency);
        filteredPayload.closeDate = calculateCloseDate(filteredPayload.frequency);

        filteredPayload.updatedAt = new Date();
        filteredPayload.createdAt = new Date();

        const attachments = req.body.attachments || [];

        const recurrenceTask = await clientDb.$transaction(async (tx) => {

            const task = await CrudHelper.create(tx.recurrenceTask, filteredPayload);

            await CrudHelper.updateOne(
                tx.recurrenceTask,
                { id: task.id },
                { taskNumber: 'RC-' + task.id }
            );

            if (attachments.length) {
                const attachmentData = attachments.map((a) => ({
                    recurrenceTaskId: task.id,
                    path: a.link
                }));

                await CrudHelper.createMany(tx.attachment, attachmentData);
            }
            return task;
        });

        const raisedToUser = await CrudHelper.read(prisma.user, { id: filteredPayload.raisedTo }, ['id', 'name', 'fcmToken', 'whatsAppNo']);
        const createdByUser = await CrudHelper.read(prisma.user, { id: filteredPayload.createdBy });

        if (raisedToUser?.fcmToken) {
            sendNotification(raisedToUser?.fcmToken, 'Recurrence Task Created', 'Recurrence Task Created By ' + createdByUser?.name);
        }

        if (raisedToUser?.whatsAppNo) {
            const templateParams = [
                raisedToUser?.name,
                recurrenceTask?.taskTitle,
                createdByUser?.name,
                new Date(recurrenceTask.closeDate).toLocaleDateString('en-GB'),
                filteredPayload.frequency
            ];

            await sendTemplateMessage(`91${raisedToUser.whatsAppNo}`, 'ad9c9d07-a57f-4b7c-a7bd-3fd32a7477dd', templateParams);
        }

        return Response.success(res, {
            data: {},
            message: 'Recurrence Task Created Successfully'
        });
    } catch (error) {
        console.log(error);
        Logger.error(error.message + ' at createRecurrenceTask function ' + controllerName);
        return Response.error(res, {
            data: {},
            message: error.message
        });
    } finally {
        await clientDb.$disconnect();
    }
};

// get recurrence task
const getRecurrenceTask = async (req, res) => {
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

        if (sanitizedQuery?.frequency) {
            query.push({ frequency: sanitizedQuery.frequency });
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
                    { frequency: { contains: searchValue } },
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

        const recurrenceTasks = await CrudHelper.findManyDetails(
            clientDb.recurrenceTask,
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

        // Process all recurrence tasks
        let response = await Promise.all(
            recurrenceTasks.map(async (task) => {
                const attachments = await CrudHelper.findManyDetails(
                    clientDb.attachment,
                    { recurrenceTaskId: task.id }
                );

                return {
                    ...task,
                    attachments: attachments.map(a => a.path),
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
        let count = await CrudHelper.getCount(clientDb.recurrenceTask, whereClause);

        return Response.success(res, {
            data: response,
            count,
            message: 'Recurrence Tasks Found'
        });
    } catch (error) {
        Logger.error(error.message + ' at getRecurrenceTask function ' + controllerName);
        return Response.error(res, {
            data: {},
            message: error.message
        });
    } finally {
        await clientDb.$disconnect();
    }
};

// update the recurrence task
const updateRecurrenceTask = async (req, res) => {
    const clientDb = req.dbConnection;

    try {
        const { id } = req.params;

        if (!id) {
            return Response.badRequest(res, {
                message: 'Recurrence Task Id is required'
            });
        }

        const attachments = req.body.attachments;

        const allowedFields = ['taskTitle', 'raisedTo', 'departmentId', 'categoryId', 'closeDate', 'taskBody', 'status', 'frequency', 'isScheduleActive'];

        const filteredPayload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

        if (filteredPayload.closeDate) {
            filteredPayload.closeDate = new Date(req.body.closeDate);
        }

        filteredPayload.updatedAt = new Date();

        const attachmentData = [];

        await clientDb.$transaction(async (tx) => {
            if (attachments?.length) {
                for (let i = 0; i < attachments.length; i++) {
                    attachmentData.push({
                        recurrenceTaskId: Number(id),
                        path: attachments[i].link
                    });
                }
            } else if (req.body?.attachments && req.body.attachments.length === 0) {
                await CrudHelper.remove(tx.attachment, { recurrenceTaskId: Number(id) });
                await CrudHelper.createMany(tx.attachment, attachmentData);
            }

            if (attachmentData.length) {
                await CrudHelper.remove(tx.attachment, { recurrenceTaskId: Number(id) });
                await CrudHelper.createMany(tx.attachment, attachmentData);
            }

            await CrudHelper.updateOne(tx.recurrenceTask, { id: Number(id) }, filteredPayload);
        });

        if (filteredPayload?.status) {
            const raisedToUser = await CrudHelper.read(prisma.user, { id: Number(updateRecurrenceTask.raisedTo) }, ['id', 'name', 'fcmToken']);
            const createdByUser = await CrudHelper.read(prisma.user, { id: Number(updateRecurrenceTask.createdBy) }, ['id', 'name', 'fcmToken']);

            if (raisedToUser?.fcmToken) {
                sendNotification(raisedToUser?.fcmToken, 'Recurrence Task Updated', 'Recurrence Task Updated To ' + filteredPayload?.status);
            }

            if (createdByUser?.fcmToken) {
                sendNotification(createdByUser?.fcmToken, 'Recurrence Task Updated', 'Recurrence Task Updated To ' + filteredPayload?.status);
            }
        }

        return Response.success(res, {
            data: {},
            message: 'Recurrence Task updated successfully'
        });
    } catch (error) {
        Logger.error(error.message + ' at updateRecurrenceTask function ' + controllerName);
        return Response.error(res, {
            data: {},
            message: error.message
        });
    } finally {
        await clientDb.$disconnect();
    }
};

module.exports = {
    createRecurrenceTask,
    getRecurrenceTask,
    updateRecurrenceTask
};