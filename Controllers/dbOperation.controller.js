const DB = require('../Helpers/db.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Response = require('../Helpers/response.helper');
const Logger = require('../Helpers/logger');
const { PrismaClient } = require('@prisma/client');

const controllerName = 'dbOperation.controller';

const migrationForClientDb = async (req, res) => {
  try {
    if (!req.query.dbName) {
      return Response.badRequest(res, {
        success: false,
        message: 'dbName is required'
      });
    }

    const response = await DB.runMigrationForClientDb(req.query.dbName);
    if (response.success) {
      return Response.success(res, {
        data: {},
        message: response.message
      });
    }
    return Response.error(res, {
      data: {},
      message: response.message
    });
  } catch (error) {
    Logger.error(error.message + ' at runMigrationForClientDb function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const makeNewMigrationOnClientDb = async (req, res) => {
  try {
    if (!req.query.dbName || !req.query.migrationName) {
      return Response.badRequest(res, {
        success: false,
        message: 'dbName and migrationName is required'
      });
    }

    const response = await DB.makeNewMigrationOnClientDb(req.query.dbName, req.query.migrationName);
    if (response.success) {
      return Response.success(res, {
        data: {},
        message: response.message
      });
    }
    return Response.error(res, {
      data: {},
      message: response.message
    });
  } catch (error) {
    Logger.error(error.message + ' at makeNewMigrationOnClientDb function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const testClientConnection = async (req, res) => {
  try {
    const mainDb = new PrismaClient();
    const clientDB = await DB.getClientDbConnection(req.query.dbName);

    const response = await CrudHelper.findManyDetails(clientDB.category, {});
    const mainDbResponse = await CrudHelper.findManyDetails(mainDb.user, {});

    return Response.success(res, {
      data: { response, mainDbResponse },
      message: 'Connection success'
    });
  } catch (error) {
    Logger.error(error.message + ' at testClientConnection function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const migrationForMainDB = async (req, res) => {
  try {
    const response = await DB.runMigrationForMainDb();
    if (response.success) {
      return Response.success(res, {
        data: {},
        message: response.message
      });
    }
    return Response.error(res, {
      data: {},
      message: response.message
    });
  } catch (error) {
    Logger.error(error.message + ' at migrationForMainDB function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  migrationForClientDb,
  makeNewMigrationOnClientDb,
  testClientConnection,
  migrationForMainDB
};
