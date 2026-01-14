const Response = require('../Helpers/response.helper');
const Logger = require('../Helpers/logger');
const AuthHelper = require('../Helpers/auth.helper');
const CrudHelper = require('../Helpers/crud.helper');
const { createNewDatabase, runMigrationForClientDb } = require('../Helpers/db.helper');
const { extractPagination } = require('../Helpers/request.helper');
const { generateUniqueId } = require('../Helpers/uniqueIdGenerator.helper');
const { phoneNumberFormater } = require('../Helpers/phoneNumberFormater.helper');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const controllerName = 'client.controller';

const createClient = async (req, res) => {
  try {
    const { name, email, phoneNumber, address, gst, pan, password } = req.body;

    const role = await prisma.role.findFirst({ where: { name: 'CLIENT' } });
    if (!role) {
      return Response.badRequest(res, {
        data: {},
        message: 'Role Note Found'
      });
    }

    // get database main db name
    const result = await prisma.$queryRaw`SELECT DATABASE() as dbName`;

    const code = `${result[0].dbName}_${generateUniqueId()}`;

    await createNewDatabase(code);
    await runMigrationForClientDb(code);

    // create client
    const client = await CrudHelper.create(prisma.client, {
      name,
      email,
      code,
      phoneNumber: phoneNumberFormater(phoneNumber),
      address,
      gst,
      pan,
      roleId: role.id
    });

    const passwordHash = await AuthHelper.generateHash(password);

    await CrudHelper.create(prisma.user, {
      name,
      email,
      phoneNumber: phoneNumberFormater(phoneNumber),
      password: passwordHash,
      clientId: client.id,
      roleId: role.id,
      active: true
    });

    return Response.success(res, {
      data: {},
      message: 'Client created successfully'
    });
  } catch (error) {
    Logger.error(`${controllerName}:createClient - ${error.message}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

// get clients list
const getClients = async (req, res) => {
  try {
    const { limit, skip } = extractPagination(req);
    const { auth_user_id, user_role, ...query } = req.query;
    const searchValue = query?.search || ''
    delete query.search

    if (searchValue && searchValue.trim !== '') {
      query.OR = [
        { name: { contains: searchValue } },
        { email: { contains: searchValue } },
        { phoneNumber: { contains: searchValue } },
        { gst: { contains: searchValue } }
      ]
    }
    const clientList = await CrudHelper.findManyDetails(prisma.client, query, 'AND', [], [], [], { skip, limit });

    return Response.success(res, {
      data: clientList,
      count: await CrudHelper.getCount(prisma.client, query),
      message: 'Clients found'
    });
  } catch (error) {
    Logger.error(`${error.message} at getClients function ${controllerName}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

// update client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return Response.error(res, {
        message: 'Client Id is required'
      });
    }

    const allowedFields = ['name', 'email', 'phoneNumber', 'address', 'gst', 'pan', 'roleId', 'active'];

    const filteredPayload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

    if (filteredPayload.phoneNumber) {
      filteredPayload.phoneNumber = phoneNumberFormater(req.body.phoneNumber);
    }

    filteredPayload.updatedAt = new Date();

    await prisma.$transaction(async (transaction) => {
      await CrudHelper.updateOne(transaction.client, { id: Number(id) }, filteredPayload);

      const data = {};

      if (req.body.name) {
        data.name = req.body.name;
      }

      if (req.body.email) {
        data.email = req.body.email;
      }

      if (req.body.phoneNumber) {
        data.phoneNumber = phoneNumberFormater(req.body.phoneNumber);
      }

      if (req.body.password) {
        data.password = await AuthHelper.generateHash(req.body.password);
      }
      if (req.body.old_email) {
        await CrudHelper.updateOne(transaction.user, { email: req.body.old_email }, data);
      }
    });

    return Response.success(res, {
      data: {},
      message: 'Client updated successfully'
    });
  } catch (error) {
    Logger.error(`${error.message} at updateClient function ${controllerName}`);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  createClient,
  getClients,
  updateClient
};
