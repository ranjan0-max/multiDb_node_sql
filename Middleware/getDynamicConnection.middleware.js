const { getClientDbConnection } = require('../Helpers/db.helper');
const Logger = require('../Helpers/logger');
const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const dynamicDbConnectionMiddleware = async (req, res, next) => {
  let clientId = null;
  let dbName = null;

  if (req.query.clientId) {
    clientId = req.query.clientId;
    delete req.query.clientId;
  } else {
    clientId = req.body.clientId;
    delete req.body.clientId;
  }

  if (!clientId) {
    return Response.badRequest(res, {
      success: false,
      message: 'clientId is required'
    });
  }

  try {
    const user = await CrudHelper.read(prisma.user, { id: Number(req.query.auth_user_id) }, ['client', 'active', 'role']);

    if (!user?.active && user?.role?.name !== 'ADMIN') {
      return Response.forbidden(res, {
        data: {},
        message: `User is not active..!`
      });
    }

    if (!user?.client?.active && user?.role?.name !== 'ADMIN') {
      return Response.forbidden(res, {
        data: {},
        message: `Client is not active..!`
      });
    }

    if (user?.role?.name === 'ADMIN') {
      const client = await CrudHelper.read(prisma.client, { id: Number(clientId) }, ['code']);
      dbName = client?.code;
    } else {
      dbName = user?.client?.code;
    }

    if (!dbName) {
      return Response.error(res, {
        data: {},
        message: `Client not found`
      });
    }

    req.dbName = dbName;
    req.dbConnection = await getClientDbConnection(dbName);
    if (!req.dbConnection) {
      return Response.error(res, {
        data: {},
        message: `Failed to connect with data base. Contact to admin"`
      });
    }
    next();
  } catch (error) {
    Logger.error(error.message + ' Failed to initialize Prisma client for DB');
    return Response.error(res, {
      data: {},
      message: `Failed to initialize Prisma client for DB "${dbName}": ${error.message}`
    });
  }
};

module.exports = dynamicDbConnectionMiddleware;
