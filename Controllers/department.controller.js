const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const { extractPagination } = require('../Helpers/request.helper');
const { SearchSource } = require('jest');
const controllerName = 'department.controller';

// create the department
const createDepartment = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const isUnique = await CrudHelper.isUnique(clientDb.department, { name: req.body.name });

    if (!isUnique) {
      return Response.badRequest(res, {
        message: 'Department already exists'
      });
    }

    const data = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await clientDb.$transaction(async (transaction) => {
      await CrudHelper.create(transaction.department, data);
    });

    return Response.success(res, {
      data: {},
      message: 'Department Created SuccessFully'
    });
  } catch (error) {
    Logger.error(error.message + ' at createDepartment function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// get department by different query parameters
const getDepartment = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const { limit, skip } = extractPagination(req.sanitizedQuery);
    const sanitizedQuery = req.sanitizedQuery;
    const searchValue = sanitizedQuery?.search || ''
    delete sanitizedQuery.search;

    let query = { ...sanitizedQuery }
    if (searchValue && searchValue.trim !== '') {
      query.OR = [
        { name: { contains: searchValue } },
      ]
    }

    let departments = await CrudHelper.findManyDetails(clientDb.department, query, 'AND', [], [], [], { limit, skip });

    return Response.success(res, {
      data: departments,
      count: await CrudHelper.getCount(clientDb.department, query),
      message: 'Department Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getDepartment function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// update the department
const updateDepartment = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const { id } = req.params;

    if (!id) {
      return Response.error(res, {
        message: 'Department Id is required'
      });
    }

    const updatePayload = {
      ...req.body,
      updatedAt: new Date()
    };

    await clientDb.$transaction(async (transaction) => {
      await CrudHelper.updateMany(transaction.department, { id: Number(id) }, updatePayload);
    });

    return Response.success(res, {
      data: {},
      message: 'Department updated successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateDepartment function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

module.exports = {
  createDepartment,
  getDepartment,
  updateDepartment
};
