const cron = require("node-cron");
const { calculateNextRunDate, calculateCloseDate } = require("../Helpers/dateTime.helper");
const { getClientDbConnection } = require("../Helpers/db.helper");
const Logger = require("../Helpers/logger");
const CrudHelper = require("../Helpers/crud.helper");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

cron.schedule("10 0 * * *", async () => {
    try {
        const activeClients = await CrudHelper.findManyDetails(
            prisma.client,
            { active: true }
        );

        for (const client of activeClients) {
            runClientCron(client);
        }
    } catch (err) {
        Logger.error("Recurrence cron failed:", err.message);
    }
});

async function runClientCron(client) {
    const clientDb = await getClientDbConnection(client.code);
    if (!clientDb) {
        Logger.error(`Could not connect to ${client.code} database in recurrenceTask Cron`);
        return;
    }
    try {
        const today = new Date();

        await clientDb.$transaction(async (transaction) => {

            // 1) get due recurrence tasks
            const recurrenceTasks = await CrudHelper.findManyDetails(
                transaction.recurrenceTask,
                {
                    isScheduleActive: true,
                    nextRunAt: { lte: today }
                }
            );

            if (recurrenceTasks.length === 0) {
                return;
            }

            // 2) create tasks
            const tasksToCreate = recurrenceTasks.map(task => ({
                taskTitle: task.taskTitle,
                taskBody: task.taskBody,
                raisedTo: task.raisedTo,
                departmentId: task.departmentId,
                categoryId: task.categoryId,
                createdBy: task.createdBy,
                status: "OPEN",
                closeDate: calculateCloseDate(task.frequency, today)
            }));

            await CrudHelper.createMany(
                transaction.task,
                tasksToCreate
            );

            // 3) update nextRunAt for recurrence tasks
            const updateNextRunAtPromises = recurrenceTasks.map(task => {
                const nextRunAt = calculateNextRunDate(task.frequency, today);

                return CrudHelper.updateOne(
                    transaction.recurrenceTask,
                    { id: task.id },
                    { nextRunAt }
                );
            });

            await Promise.all(updateNextRunAtPromises);

            // 4) fetch new tasks created in this run
            const newTasks = await CrudHelper.findManyDetails(
                transaction.task,
                {
                    createdAt: { gte: today },
                    taskNumber: null
                },
                'AND',
                ['id']
            );

            // 5) set taskNumber
            for (const task of newTasks) {
                await CrudHelper.updateOne(
                    transaction.task,
                    { id: task.id },
                    { taskNumber: 'WC-' + task.id }
                );
            }
        });
    } catch (err) {
        Logger.error(`Client ${client.code} cron error in recurrenceTask Cron:`, err.message);
    } finally {
        await clientDb.$disconnect();
    }
}



