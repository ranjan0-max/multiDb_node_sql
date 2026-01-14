const Response = require('../Helpers/response.helper');
const DB = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const { sanitizeObject } = require('../Helpers/senitizeData.helper');
const { extractPagination } = require('../Helpers/request.helper');
const { getSearchQuery } = require('../Services/roles.service');
const controllerName = 'role.controller';

const { PrismaClient } = require('@prisma/client');
const { ADMIN_ROLE_ID } = require('../Constants/constant');
const prisma = new PrismaClient();

// create the role
const createRole = async (req, res) => {
  try {
    if (req.body.name.toLowerCase() === 'admin' || req.body.name.toLowerCase() === 'client') {
      return Response.badRequest(res, {
        message: 'These role are reserved'
      });
    }

    await DB.isUnique(prisma.clientRoleMapping,
      {
        clientId: req.body.clientId,
        role: {
          name: req.body.name.toUpperCase()
        }
      },
    );

    await prisma.$transaction(async (transaction) => {
      const role = await DB.create(transaction.role, {
        name: req.body.name.toUpperCase()
      });

      await DB.create(transaction.clientRoleMapping, {
        clientId: req.body.clientId,
        roleId: role.id
      });
    });

    return Response.success(res, {
      data: {},
      message: 'Role Created SuccessFully'
    });
  } catch (error) {
    Logger.error(error.message + ' at createRole function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

// get role by different query parameter
const getRole = async (req, res) => {
  try {
    const { limit, skip } = extractPagination(req);
    const { auth_user_id, user_role, ...query } = req.query;

    const searchValue = query?.search || ''
    delete query.search

    if (user_role !== ADMIN_ROLE_ID || query?.clientId) {
      const user = await DB.read(prisma.user, { id: auth_user_id });
      const clientRoleMapping = await DB.findManyDetails(prisma.clientRoleMapping, {
        clientId: user.clientId || Number(query?.clientId)
      });
      const roleIds = clientRoleMapping.map((mapping) => mapping.roleId);
      query.id = { in: roleIds };
    }
    delete query.clientId;

    let whereQuery = {};
    if (searchValue && searchValue.trim() !== '') {
      ({ whereQuery } = await getSearchQuery(searchValue.trim(), query));
    } else {
      whereQuery = { ...query };
    }

    let roles = await DB.findManyDetails(prisma.role, whereQuery, 'AND', [], [], [], { limit, skip });

    const roleMap = [];
    roles.forEach((r) => {
      roleMap[r.id] = r.name;
    });

    roles = roles.map((role) => ({
      ...role,
      managingRoleName: roleMap[role.roleId] || null
    }));

    return Response.success(res, {
      data: roles,
      count: await DB.getCount(prisma.role, whereQuery),
      message: 'Role Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getRole function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

const getRoleForCreateClient = async (req, res) => {
  try {
    const { auth_user_id, user_role, ...query } = req.query;
    const role = await DB.findManyDetails(prisma.role, { name: 'CLIENT' });

    return Response.success(res, {
      data: role,
      message: 'Role Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getRoleForCreateClient function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

// update role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return Response.error(res, {
        message: 'Role Id is required'
      });
    }

    const updatePayload = sanitizeObject({
      ...req.body,
      updatedAt: new Date()
    });

    updatePayload.name = updatePayload.name.toUpperCase();

    await prisma.$transaction(async (transaction) => {
      await DB.isUnique(transaction.role,
        {
          name: updatePayload.name.toUpperCase(),
        },
      );
      await DB.updateOne(transaction.role, { id: Number(id) }, updatePayload);
    });

    return Response.success(res, {
      data: {},
      message: 'Role updated successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateRole function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  createRole,
  getRole,
  getRoleForCreateClient,
  updateRole
};
