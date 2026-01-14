const INITIAL_REDIS_DATA = [
  'Assign Task',
  'View Tasks',
  'Raised Tasks',
  'Recieved Tasks',
  'Update Task']

const ASSIGN_STEPS = [
  'Assign Task',
  'raised',
  'selectDepartment',
  'selectCategory',
  'taskTitle',
  'taskBody',
  'attachments',
  'closeDate'];

const UPDATE_STEPS = [
  'Update Task',
  'selectTaskForUpdate',
  'selectStatusForUpdate']

const CLOSE_DATE_FILTERS = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  TOMORROW: 'TOMORROW',
  CUSTOM: 'CUSTOM',
  LAST_7_DAYS: 'LAST_7_DAYS',
  LAST_30_DAYS: 'LAST_30_DAYS',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH'
};

module.exports = {
  ADMIN_ROLE_ID: 1,
  CLIENT_ROLE_ID: 2, INITIAL_REDIS_DATA, ASSIGN_STEPS, UPDATE_STEPS, CLOSE_DATE_FILTERS
};

