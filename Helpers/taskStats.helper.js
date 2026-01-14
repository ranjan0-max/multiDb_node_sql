const { CLOSE_DATE_FILTERS } = require('../Constants/constant');

async function calculateTaskStats(tasks) {
    const currentDate = new Date();

    const openWithinTimeline = tasks.filter(
        (task) =>
            (task.status === "OPEN" || task.status === "HOLD" || task.status === 'RE_OPEN') &&
            new Date(task.closeDate) >= currentDate
    ).length;

    const exceedingTimeline = tasks.filter(
        (task) =>
            (task.status !== "CLOSED") &&
            new Date(task.closeDate) < currentDate
    ).length;


    const completedOnTime = tasks.filter(
        (task) =>
            task.status === "CLOSED" &&
            new Date(task.closeDate) >= new Date(task.updatedAt)
    ).length;

    const completedWithDelay = tasks.filter(
        (task) =>
            (task.status === "CLOSED") &&
            new Date(task.closeDate) < new Date(task.updatedAt)
    ).length;

    return {
        openWithinTimeline,
        exceedingTimeline,
        completedOnTime,
        completedWithDelay,
    };
}

async function closeDateFilterHandler(request) {
    let closeDate = {};

    const today = new Date();
    const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    if (request.closedDate === 'TODAY') {
        closeDate = {
            gte: todayStart,
            lte: todayEnd
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.YESTERDAY) {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setUTCDate(todayStart.getUTCDate() - 1);

        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setUTCDate(todayEnd.getUTCDate() - 1);

        closeDate = {
            gte: yesterdayStart,
            lte: yesterdayEnd
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.TOMORROW) {
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1);

        const tomorrowEnd = new Date(todayEnd);
        tomorrowEnd.setUTCDate(todayEnd.getUTCDate() + 1);

        closeDate = {
            gte: tomorrowStart,
            lte: tomorrowEnd
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.CUSTOM) {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);
        endDate.setHours(23, 59, 59, 999);
        closeDate = {
            gte: startDate,
            lte: endDate
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.LAST_7_DAYS) {
        const last7DaysStart = new Date(todayStart);
        last7DaysStart.setUTCDate(todayStart.getUTCDate() - 7);

        const last7DaysEnd = new Date(todayEnd);
        closeDate = {
            gte: last7DaysStart,
            lte: last7DaysEnd
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.LAST_30_DAYS) {
        const last30DaysStart = new Date(todayStart);
        last30DaysStart.setUTCDate(todayStart.getUTCDate() - 30);

        const last30DaysEnd = new Date(todayEnd);
        closeDate = {
            gte: last30DaysStart,
            lte: last30DaysEnd
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.THIS_MONTH) {
        const firstDayOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0));
        const lastDayOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        closeDate = {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth
        }
    } else if (request.closedDate === CLOSE_DATE_FILTERS.LAST_MONTH) {
        const firstDayOfLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1, 0, 0, 0, 0));
        const lastDayOfLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
        closeDate = {
            gte: firstDayOfLastMonth,
            lte: lastDayOfLastMonth
        }
    } else {
        closeDate = {}
    }
    return closeDate;
}

module.exports = { calculateTaskStats, closeDateFilterHandler };
