const cron = require('node-cron');
const Logger = require('../Helpers/logger');
const CrudHelper = require('../Helpers/crud.helper');
const { getClientDbConnection } = require('../Helpers/db.helper');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getDate() {
  const istNow = new Date();

  const yyyy = istNow.getUTCFullYear();
  const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istNow.getUTCDate()).padStart(2, '0');

  const startOfDayUTC = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);

  return startOfDayUTC;
}

cron.schedule('15 0 * * *', async () => {
  try {
    const getAlldataBase = await CrudHelper.findManyDetails(prisma.client, {}, 'AND', ['code']);
    for (let database of getAlldataBase) {
      const newConnection = await getClientDbConnection(database.code);
      if (newConnection) {
        await CrudHelper.updateMany(newConnection.task, { closeDate: { lt: getDate() }, status: { not: 'CLOSED' } }, { status: 'DELAYED' });
      } else {
        Logger.error('Unable to connect to the database:', database.code);
      }
    }
  } catch (error) {
    Logger.error('UpdateTaskStatus cron job error:', error.message);
  }
});

module.exports = cron;
