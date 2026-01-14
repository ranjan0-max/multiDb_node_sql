const Response = require('../Helpers/response.helper');
const Logger = require('../Helpers/logger');
const AuthHelper = require('../Helpers/auth.helper');
const DB = require('../Helpers/crud.helper');
const controllerName = 'user.controller';
const { extractPagination } = require('../Helpers/request.helper');
const { phoneNumberFormater } = require('../Helpers/phoneNumberFormater.helper');
const { sendTemplateMessage } = require('../Services/whatsappMessage.service');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { ADMIN_ROLE_ID, CLIENT_ROLE_ID } = require('../Constants/constant');

// Create a new user
const createUser = async (req, res) => {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: req.body.email }
    });
    if (existingUser) {
      return Response.badRequest(res, { message: 'Email already in use' });
    }

    const passwordHash = await AuthHelper.generateHash(req.body.password);

    req.body.phoneNumber = phoneNumberFormater(req.body.phoneNumber);

    const newUser = await DB.create(prisma.user, { ...req.body, password: passwordHash });

    let phoneNumberString = '91' + newUser.phoneNumber;
    await sendTemplateMessage(phoneNumberString, '15d22476-f181-4f4c-b42e-e91277e352ea', [newUser.name]);

    return Response.success(res, {
      data: {},
      message: 'User Created Successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at createUser function ' + controllerName);
    return Response.badRequest(res, {
      message: error.message
    });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const roleId = req.query.user_role;
    const logedInUserId = req.query.auth_user_id;
    const { limit, skip } = extractPagination(req);
    const searchValue = req?.query?.search || ''

    delete req.query.auth_user_id;
    delete req.query.user_role;
    delete req.query.search;

    if (Number(roleId) === ADMIN_ROLE_ID) {
      req.query.roleId = { not: ADMIN_ROLE_ID };
    } else {
      req.query.roleId = { notIn: [ADMIN_ROLE_ID, CLIENT_ROLE_ID] };
      req.query.id = { not: logedInUserId };
      const user = await DB.read(prisma.user, { id: logedInUserId });
      req.query.clientId = user.clientId;
    }

    if (req?.query?.clientId) {
      req.query.clientId = Number(req.query.clientId);
    }

    let query = { ...req.query, AND: [] }
    if (searchValue && searchValue.trim !== '') {
      query.AND.push({
        OR: [
          { name: { contains: searchValue } },
          { email: { contains: searchValue } },
          { phoneNumber: { contains: searchValue } },
          {
            role: {
              name: {
                contains: searchValue
              }
            }
          }
        ]
      })
    }
    let userList = await DB.findManyDetails(prisma.user, query, 'AND', [], ['role'], [], { skip, limit });

    return Response.success(res, {
      data: userList,
      count: await DB.getCount(prisma.user, query),
      message: 'Users Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getUsers function ' + controllerName);
    return Response.badRequest(res, {
      message: error.message
    });
  }
};

// Update user information
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return Response.badRequest(res, {
        message: 'User Id is required'
      });
    }

    let data = { ...req.body, updatedAt: new Date() };

    if (data.password) {
      data.password = await AuthHelper.generateHash(data.password);
    }

    if (data.phoneNumber) {
      data.phoneNumber = phoneNumberFormater(data.phoneNumber);
    }

    await DB.updateOne(prisma.user, { id: parseInt(id) }, data);

    return Response.success(res, {
      data: {},
      message: 'User Updated Successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateUser function ' + controllerName);
    return Response.badRequest(res, {
      message: error.message
    });
  }
};

// update the menu config of client
const updateMenuConfig = async (req, res) => {
  try {
    const { email, menuIds } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!user) {
      return Response.badRequest(res, { message: 'User Not Found' });
    }

    await DB.remove(prisma.userConfig, { userId: user.id });

    await prisma.$transaction([
      prisma.userConfig.deleteMany({ where: { userId: user.id } }),
      prisma.userConfig.createMany({
        data: menuIds.map((menuId) => ({
          userId: user.id,
          menuId: Number(menuId)
        })),
        skipDuplicates: true
      })
    ]);

    return Response.success(res, {
      data: {},
      message: 'Menu Config Updated Successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateMenuConfig function ' + controllerName);
    return Response.badRequest(res, {
      message: error.message
    });
  }
};

const getMenuConfig = async (req, res) => {
  try {
    const { auth_user_id, user_role, email } = req.query;

    const user = await DB.read(prisma.user, { email: email });

    if (!user) {
      return Response.badRequest(res, { message: 'User Not Found' });
    }

    const menuConfig = await DB.findManyDetails(prisma.userConfig, {
      userId: user.id
    });

    return Response.success(res, {
      data: menuConfig,
      message: 'Menu Config Found'
    });
  } catch (error) {
    Logger.error(`${error.message} at getMenuConfig function ${controllerName}`);
    return Response.badRequest(res, {
      data: {},
      message: error.message
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  updateMenuConfig,
  getMenuConfig
};
