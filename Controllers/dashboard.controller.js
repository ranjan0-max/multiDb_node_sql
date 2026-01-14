const Response = require('../Helpers/response.helper');
const Logger = require('../Helpers/logger');
const CrudHelper = require('../Helpers/crud.helper');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const controllerName = 'client.controller';

const getDashboardDataForMobile = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const query = [{ raisedTo: req.query.auth_user_id }, { createdBy: req.query.auth_user_id }];

    const tasks = await CrudHelper.findManyDetails(clientDb.task, query, 'OR');

    let totalReceived = 0;
    let totalRaised = 0;
    let totalOpenRecieved = 0;
    let totalOpenRaised = 0;
    let totalCloseRecieved = 0;
    let totalCloseRaised = 0;
    let totalHoldRecieved = 0;
    let totalHoldRaised = 0;
    let totalDelayedRecieved = 0;
    let totalDelayedRaised = 0;
    let tScore = 0;

    for (let task of tasks) {
      if (task.raisedTo == req.query.auth_user_id) {
        totalReceived += 1;
      }

      if (task.createdBy == req.query.auth_user_id) {
        totalRaised += 1;
      }

      if ((task.status.toLowerCase() == 'open' || task.status.toLowerCase() == 're_open') && task.raisedTo == req.query.auth_user_id) {
        totalOpenRecieved += 1;
      }

      if (task.status.toLowerCase() == 'delayed' && task.raisedTo == req.query.auth_user_id) {
        totalDelayedRecieved += 1;
      }

      if (task.status.toLowerCase() == 'delayed' && task.createdBy == req.query.auth_user_id) {
        totalDelayedRaised += 1;
      }

      if ((task.status.toLowerCase() == 'open' || task.status.toLowerCase() == 're_open') && task.createdBy == req.query.auth_user_id) {
        totalOpenRaised += 1;
      }

      if (task.status.toLowerCase() == 'closed' && task.raisedTo == req.query.auth_user_id) {
        totalCloseRecieved += 1;
      }

      if (task.status.toLowerCase() == 'closed' && task.createdBy == req.query.auth_user_id) {
        totalCloseRaised += 1;
      }

      if (task.status.toLowerCase() == 'hold' && task.raisedTo == req.query.auth_user_id) {
        totalHoldRecieved += 1;
      }

      if (task.status.toLowerCase() == 'hold' && task.createdBy == req.query.auth_user_id) {
        totalHoldRaised += 1;
      }
    }

    const total = totalHoldRecieved + totalCloseRecieved + totalDelayedRecieved + totalOpenRecieved;

    if (total > 0) {
      tScore = (totalCloseRecieved / total) * 100;
    }

    return Response.success(res, {
      data: {
        totalReceived,
        totalRaised,
        totalOpenRecieved,
        totalOpenRaised,
        totalCloseRecieved,
        totalCloseRaised,
        totalHoldRecieved,
        totalHoldRaised,
        totalDelayedRecieved,
        totalDelayedRaised,
        tScore
      },
      message: 'Dashboard Data Found'
    });
  } catch (error) {
    Logger.error(`${error.message} at getDashboardDataForMobile function ${controllerName}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const getClientWebDashboardData = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const tasks = await clientDb.$queryRaw`
        SELECT status, COUNT(id) AS total_number
        FROM Task
        GROUP BY status
    `;

    const serializedTasks = tasks.map((t) => ({
      ...t,
      total_number: Number(t.total_number)
    }));

    return Response.success(res, {
      data: serializedTasks,
      message: 'Dashboard Data Found'
    });
  } catch (error) {
    Logger.error(`${error.message} at getWebDashboardData function ${controllerName}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const getUserDashboardData = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const tasks = await CrudHelper.findManyDetails(
      clientDb.task,
      [{ raisedTo: req.query.auth_user_id }, { createdBy: req.query.auth_user_id }],
      'OR'
    );
    let totalReceived = 0;
    let totalRaised = 0;

    for (let task of tasks) {
      if (task.raisedTo == req.query.auth_user_id) {
        totalReceived += 1;
      }
      if (task.createdBy == req.query.auth_user_id) {
        totalRaised += 1;
      }
    }

    return Response.success(res, {
      data: {
        totalReceived,
        totalRaised
      },
      message: 'Dashboard Data Found'
    });
  } catch (error) {
    Logger.error(`${error.message} at getWebDashboardData function ${controllerName}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  getDashboardDataForMobile,
  getClientWebDashboardData,
  getUserDashboardData
};
