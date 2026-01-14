const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const CrudHelper = require("../Helpers/crud.helper");
const { getClientDbConnection } = require('../Helpers/db.helper');
const { sendTemplateMessage } = require('../Services/whatsappMessage.service');
const { calculateTaskStats } = require("../Helpers/taskStats.helper");
const Logger = require('../Helpers/logger');

const prisma = new PrismaClient();

const morningReminder = cron.schedule("0 10 * * * ", async () => {
    try {
        const users = await CrudHelper.findManyDetails(prisma.user, { active: true, whatsAppNo: { not: null } }, 'AND', ['id', 'name', 'whatsAppNo', 'client']);

        for (let user of users) {
            const newConnection = await getClientDbConnection(user.client.code);
            if (newConnection) {
                let tasks = await CrudHelper.findManyDetails(
                    newConnection.task,
                    { raisedTo: user.id, status: { not: 'CLOSED' } }, 'AND', [], [], [{ createdAt: 'desc' }],
                    { skip: 0, limit: 2 }
                );

                if (!tasks.length) continue;
                const createdBy = user.client.name
                let taskParams = tasks.map((task, index) => `${index + 1}. Task Number: ${task.taskNumber}, Task Title: ${task.taskTitle}, Assigned By: ${createdBy}`);
                const params = [
                    user.name,
                    taskParams[0] || " ",
                    taskParams[1] || " ",
                    taskParams[2] || " "
                ];

                await sendTemplateMessage(
                    user.whatsAppNo,
                    "9fbe09b6-0b07-42ad-b1a8-ddcc84815f63",
                    params
                );

            } else {
                Logger.error('Unable to connect to the database:', user.client.code);
            }
        }
    } catch (err) {
        Logger.error("Error sending reminders:", err.message);
    }
});

const eveningReminder = cron.schedule("0 16 * * * ", async () => {
    try {
        const users = await CrudHelper.findManyDetails(
            prisma.user,
            { active: true, whatsAppNo: { not: null } },
            "AND",
            ["id", "name", "whatsAppNo", "client"]
        );

        for (let user of users) {
            const newConnection = await getClientDbConnection(user.client.code);

            if (!newConnection) {
                Logger.error("Unable to connect to the database:", user.client.code);
                continue;
            }

            const tasks = await CrudHelper.findManyDetails(
                newConnection.task,
                { raisedTo: user.id },
                "AND",
                ["taskTitle", "status", "closeDate", "updatedAt"],
            );

            const stats = await calculateTaskStats(tasks);

            const messageParams = [
                user.name,
                stats.openWithinTimeline,
                stats.exceedingTimeline,
                stats.completedOnTime,
                stats.completedWithDelay
            ]

            await sendTemplateMessage(
                user.whatsAppNo,
                "c7b21476-e228-4bfd-8a27-216fdcc648ed",
                messageParams
            );
        }
    } catch (err) {
        Logger.error("Error sending reminders:", err.message);
    }
});

module.exports = { morningReminder, eveningReminder };

