const Response = require('../Helpers/response.helper');
const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const { extractPagination } = require('../Helpers/request.helper');
const controllerName = 'category.controller';

// create the department
const createCategory = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const isUnique = await CrudHelper.isUnique(clientDb.category, { name: req.body.name });

    if (!isUnique) {
      return Response.badRequest(res, {
        message: 'Category already exists'
      });
    }

    const data = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await clientDb.$transaction(async (transaction) => {
      await CrudHelper.create(transaction.category, data);
    });

    return Response.success(res, {
      data: {},
      message: 'Category Created SuccessFully'
    });
  } catch (error) {
    Logger.error(error.message + ' at createCategory function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// get department by different query parameters
const getCategory = async (req, res) => {
  const clientDb = req.dbConnection;
  try {
    const { limit, skip } = extractPagination(req);
    const { auth_user_id, user_role, ...query } = req.query;

    const searchValue = query?.search || ''
    delete query.search;

    let where = { ...query, AND: [] }
    if (searchValue && searchValue.trim !== '') {
      where.AND.push({
        OR: [
          { name: { contains: searchValue } },
          {
            Department: {
              name: {
                contains: searchValue
              }
            }
          }
        ]
      })
    }

    let categories = await CrudHelper.findManyDetails(clientDb.category, where, 'AND', [], ['Department'], [], { limit, skip });

    return Response.success(res, {
      data: categories,
      count: await CrudHelper.getCount(clientDb.category, where),
      message: 'Category Found'
    });
  } catch (error) {
    Logger.error(error.message + ' at getCategory function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

// update the department
const updateCategory = async (req, res) => {
  const clientDb = req.dbConnection;

  try {
    const { id } = req.params;

    if (!id) {
      return Response.error(res, {
        message: 'Category Id is required'
      });
    }

    const updatePayload = {
      ...req.body,
      updatedAt: new Date()
    };

    await clientDb.$transaction(async (transaction) => {
      await CrudHelper.updateMany(transaction.category, { id: Number(id) }, updatePayload);
    });

    return Response.success(res, {
      data: {},
      message: 'Category updated successfully'
    });
  } catch (error) {
    Logger.error(error.message + ' at updateCategory function ' + controllerName);
    return Response.error(res, {
      data: {},
      message: error.message
    });
  } finally {
    await clientDb.$disconnect();
  }
};

module.exports = {
  createCategory,
  getCategory,
  updateCategory
};
