const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isUnique(model, data) {
  return new Promise(async (resolve, reject) => {
    try {
      const exists = await model.findFirst({ where: data });

      if (exists) {
        reject({ message: "Data already exists" });
      } else {
        resolve(true);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function getCount(model, query = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const count = await model.count({ where: query });
      resolve(count);
    } catch (err) {
      reject(err);
    }
  });
}

function create(model, data) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.create({ data });
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}


function createMany(model, data) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.createMany({ data });
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}


function read(model, query, select = [], orderBy = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.findFirst({
        where: query,
        select: select.length
          ? Object.fromEntries(select.map((key) => [key, true]))
          : undefined,
        orderBy
      });

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function updateMany(model, query, data) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.updateMany({
        where: query,
        data
      });

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function updateOne(model, query, data) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.update({
        where: query,
        data
      });

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function remove(model, query) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await model.deleteMany({
        where: query
      });

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

function findManyDetails(
  model,
  query,
  logical = 'AND',
  projection = [],
  include = [],
  orderBy = [],
  pagination = {}
) {
  return new Promise(async (resolve, reject) => {
    try {
      let whereClause = {};

      if (Array.isArray(query)) {
        if (logical === 'OR') {
          whereClause = { OR: query };
        } else if (logical === 'AND') {
          whereClause = { AND: query };
        } else {
          throw new Error("Invalid logical operator. Use 'AND' or 'OR'.");
        }
      } else if (query && typeof query === 'object') {
        whereClause = query;
      }

      const result = await model.findMany({
        where: whereClause,
        select: projection.length
          ? Object.fromEntries(projection.map((key) => [key, true]))
          : undefined,
        include: include.length
          ? Object.fromEntries(include.map((key) => [key, true]))
          : undefined,
        skip: pagination.skip ? pagination.skip : undefined,
        take: pagination.limit ? pagination.limit : undefined,
        orderBy: orderBy.length ? orderBy : undefined
      });

      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  isUnique,
  getCount,
  read,
  create,
  createMany,
  updateMany,
  updateOne,
  remove,
  findManyDetails
};
