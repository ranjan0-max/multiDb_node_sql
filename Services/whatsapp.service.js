const axios = require('axios');
const Logger = require('../Helpers/logger');
const { getClientDbConnection } = require('../Helpers/db.helper');
const { createTask } = require('../Controllers/task.controller');
const { sendTemplateMessage } = require('../Services/whatsappMessage.service');
const { uploadBase64File } = require('../Helpers/uploadFileOnServer.helper');
const { createSession, getSession, destroySession } = require('../Helpers/redis.helper');
const CrudHelper = require('../Helpers/crud.helper');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sendWhatsappMessage = async (phone, message) => {
  try {
    let messageText = typeof message === 'string' ? message : JSON.stringify(message);
    let data = new URLSearchParams({
      channel: 'whatsapp',
      source: process.env.GUPSHUP_SOURCE_NUMBER,
      destination: phone,
      message: messageText,
      'src.name': 'Hercule'
    }).toString();

    const response = await axios.post(process.env.GUPSHUP_WHATSAPP_MESSAGE_URL, data, {
      headers: {
        apikey: process.env.GUPSHUP_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  } catch (error) {
    Logger.error(`WhatsApp send error: ${JSON.stringify(error.response?.data || error.message)}`);
    return { error: error.response?.data || error.message };
  }
};

// SHOW MAIN MENU (Quick Replies on WhatsApp)
async function showMainMenu(apiPhone) {
  const message = {
    type: 'quick_reply',
    content: {
      type: 'text',
      text: 'Choose task to continue with:'
    },
    options: [
      { type: 'text', title: 'Assign Task', postback: 'assign_task' },
      { type: 'text', title: 'View Task', postback: 'view_task' },
      { type: 'text', title: 'Update Task', postback: 'update_task' }
    ]
  };
  await sendWhatsappMessage(apiPhone, JSON.stringify(message));
}

// UPDATE REDIS SESSION + SEND MESSAGE
async function sendMessageAndUpdateRedis(phone, message, dbPhone, taskData, nextStep = null) {
  if (nextStep) {
    taskData.step = nextStep;
  }
  await createSession(dbPhone, taskData);
  await sendWhatsappMessage(phone, message);
}

// ASSIGN TASK HELPERS

// Step 1: Handle assignee phone number
async function handleRaisedTo(payload, apiPhone, dbPhone, taskData, user) {
  const trimmedNumber = (payload?.text || '').replace(/\s+/g, '').replace(/^\+91|^0/, '');
  if (!/^\d+$/.test(trimmedNumber)) {
    await sendWhatsappMessage(apiPhone, 'Invalid number. Enter a valid WhatsApp number.');
    return;
  }

  const assignee = await CrudHelper.read(prisma.user, { whatsAppNo: trimmedNumber.replace(/^91/, '') });
  if (!assignee) {
    await sendWhatsappMessage(apiPhone, 'The number entered is not registered.');
    return;
  }
  taskData.raisedTo = assignee.id;
  const clientDb = await getClientDbConnection(user.client.code);
  const departments = await CrudHelper.findManyDetails(clientDb.department, {});
  taskData.departments = departments;
  const sections = [
    {
      title: 'Departments',
      options: departments.map((department) => ({
        type: 'text',
        title: department.name,
        id: String(department.id),
        postbackText: String(department.id)
      }))
    }
  ];

  const listMessage = {
    type: 'list',
    title: 'Select department',
    body: 'Please choose a department from the list below:',
    globalButtons: [{ type: 'text', title: 'Department List' }],
    items: sections
  };

  await sendMessageAndUpdateRedis(apiPhone, JSON.stringify(listMessage), dbPhone, taskData, 'selectDepartment');
}

async function handleSelectDepartment(payload, apiPhone, dbPhone, taskData, user) {
  const choiceId = Number(payload.postbackText);
  if (!choiceId) {
    await sendWhatsappMessage(apiPhone, 'Invalid choice. Please select a department from the list.');
    return;
  }
  taskData.departmentId = choiceId;
  const clientDb = await getClientDbConnection(user.client.code);
  const categories = await CrudHelper.findManyDetails(clientDb.category, { departmentId: choiceId });
  taskData.categories = categories;

  const sections = [
    {
      title: 'Categories',
      options: categories.map((category) => ({
        type: 'text',
        title: category.name,
        id: String(category.id),
        postbackText: String(category.id)
      }))
    }
  ];

  const categoryListMessage = {
    type: 'list',
    title: 'Select category',
    body: 'Please choose a category from the list below:',
    globalButtons: [{ type: 'text', title: 'Category List' }],
    items: sections
  };

  await sendMessageAndUpdateRedis(apiPhone, JSON.stringify(categoryListMessage), dbPhone, taskData, 'selectCategory');
}

// Step 3: Handle attachments
async function handleAttachments(payload, event, apiPhone, dbPhone, taskData) {
  const messageType = event.payload.type;
  if (messageType === 'image' || messageType === 'file') {
    try {
      const fileUrl = payload?.url;
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');

      const mimeType = response.headers['content-type'];
      const base64String = `data:${mimeType};base64,${buffer.toString('base64')}`;

      const savedPath = await uploadBase64File(base64String, 'attachments');
      taskData.attachments.push({ link: savedPath });

      await createSession(dbPhone, taskData);
      await sendWhatsappMessage(apiPhone, 'Attachment received. Send more or type "done".');
    } catch (err) {
      Logger.error('Attachment Save Error:', err.message);
      await sendWhatsappMessage(apiPhone, 'Failed to process the attachment. Please try again.');
    }
  } else if (payload?.text?.toLowerCase() === 'done') {
    await sendMessageAndUpdateRedis(apiPhone, 'Enter due date (DD/MM/YYYY):', dbPhone, taskData, 'closeDate');
  } else {
    await sendWhatsappMessage(apiPhone, 'Invalid input. Send an image or type "done".');
  }
}

// Step 4: Handle due date & FINAL SAVE to DB
async function handleCloseDate(payload, apiPhone, dbPhone, taskData, user) {
  const dateInput = payload?.text;
  if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(dateInput)) {
    await sendWhatsappMessage(apiPhone, 'Enter valid date format DD/MM/YYYY.');
    return;
  }

  const [day, month, year] = dateInput.split('/').map(Number);
  const inputDate = new Date(year, month - 1, day);
  inputDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate < today) {
    await sendWhatsappMessage(apiPhone, 'Date cannot be in the past.');
    return;
  }

  taskData.closeDate = inputDate;
  const clientDb = await getClientDbConnection(user.client.code);
  const taskReq = { dbConnection: clientDb, body: { ...taskData, createdBy: user.id, status: 'OPEN', customRequest: true } };

  await createTask(taskReq);
  await sendWhatsappMessage(apiPhone, 'Task created successfully');

  if (taskData.raisedTo) {
    const assigneeUser = await CrudHelper.read(prisma.user, { id: taskData.raisedTo });
    if (assigneeUser?.whatsAppNo) {
      const assigneePhone = assigneeUser.whatsAppNo.startsWith('91') ? assigneeUser.whatsAppNo : '91' + assigneeUser.whatsAppNo;
      const templateParams = [assigneeUser.name, taskData.taskTitle, user.name, new Date(taskData.closeDate).toLocaleDateString('en-GB')];
      await sendTemplateMessage(assigneePhone, 'ad9c9d07-a57f-4b7c-a7bd-3fd32a7477dd', templateParams);
    }
  }
  await showMainMenu(apiPhone);
  await destroySession(dbPhone);
}

// HANDLING FULL ASSIGN TASK FLOW
async function handleAssignTaskFlow(payload, event, apiPhone, dbPhone, user) {
  let assignSession = await getSession(dbPhone);
  if (payload?.text === 'Assign Task' || payload?.title === 'Assign Task' || (assignSession && assignSession.step)) {
    let taskData = assignSession || { step: 'raisedTo' };
    if (payload?.text === 'Assign Task' || payload?.title === 'Assign Task') {
      await createSession(dbPhone, taskData);
      await sendWhatsappMessage(apiPhone, 'Enter assignee phone number:');
      return;
    }
    switch (taskData.step) {
      case 'raisedTo':
        await handleRaisedTo(payload, apiPhone, dbPhone, taskData, user);
        break;

      case 'selectDepartment':
        await handleSelectDepartment(payload, apiPhone, dbPhone, taskData, user);
        break;

      case 'selectCategory':
        const choiceId = Number(payload.postbackText);

        if (!choiceId) {
          await sendWhatsappMessage(apiPhone, 'Invalid choice. Please select a category from the list.');
          return;
        }
        taskData.categoryId = choiceId;
        await sendMessageAndUpdateRedis(apiPhone, 'Enter task title:', dbPhone, taskData, 'taskTitle');
        break;

      case 'taskTitle':
        taskData.taskTitle = payload?.text;

        await sendMessageAndUpdateRedis(apiPhone, 'Enter task description:', dbPhone, taskData, 'taskBody');
        break;

      case 'taskBody':
        taskData.taskBody = payload?.text;
        taskData.attachments = [];

        await sendMessageAndUpdateRedis(
          apiPhone,
          'Send attachments one by one. Type "done" when finished.',
          dbPhone,
          taskData,
          'attachments'
        );
        break;

      case 'attachments':
        await handleAttachments(payload, event, apiPhone, dbPhone, taskData);
        break;

      case 'closeDate':
        await handleCloseDate(payload, apiPhone, dbPhone, taskData, user);
        break;
    }
  }
}

// VIEW TASK FLOW (Lists recent task)
async function handleViewTaskFlow(payload, apiPhone, user) {
  try {
    const clientDb = await getClientDbConnection(user.client.code);
    let tasks = [];
    let heading = '';

    if (payload?.title === 'Raised Tasks') {
      heading = '*Tasks Raised By You*';
      tasks = await CrudHelper.findManyDetails(clientDb.task, { createdBy: user.id }, 'AND', [], [], [], { skip: 0, limit: 3 });
    } else if (payload?.title === 'Recieved Tasks') {
      heading = '*Tasks Raised To You*';
      tasks = await CrudHelper.findManyDetails(clientDb.task, { raisedTo: user.id }, 'AND', [], [], [], { skip: 0, limit: 3 });
    } else {
      const message = {
        type: 'quick_reply',
        content: {
          type: 'text',
          text: 'Choose Task Type:'
        },
        options: [
          {
            type: 'text',
            title: 'Raised Tasks',
            postback: 'action=raised_task'
          },
          {
            type: 'text',
            title: 'Recieved Tasks',
            postback: 'action=recieved_task'
          }
        ]
      };
      await sendWhatsappMessage(apiPhone, JSON.stringify(message));
      return;
    }

    if (!tasks.length) {
      await sendWhatsappMessage(apiPhone, `${heading}\nNo tasks found.`);
      await showMainMenu(apiPhone);
    } else {
      let taskMsg = heading + '\n';
      tasks.forEach((t, i) => {
        taskMsg +=
          `\n*Task - ${i + 1}*\n` +
          `  ID: ${t.taskNumber}\n` +
          `  Task Title: ${t.taskTitle}\n` +
          `  Close Date: ${new Date(t.closeDate).toLocaleDateString('en-GB')}\n` +
          `  Status: ${t.status}\n`;
      });

      const message = {
        type: 'cta_url',
        body: taskMsg,
        url: 'https://sworkcheck.coderootz.com/home_page',
        display_text: 'Continue on App'
      };
      await sendWhatsappMessage(apiPhone, JSON.stringify(message));
      await showMainMenu(apiPhone);
    }
  } catch (err) {
    Logger.error('View Tasks Error: ' + err.message);
    await sendWhatsappMessage(apiPhone, 'Sorry, something went wrong while fetching your tasks.');
  }
}

// UPDATE TASK FLOW
async function handleUpdateTaskFlow(payload, apiPhone, dbPhone, user) {
  let updateSession = await getSession(dbPhone);
  if (!updateSession) {
    const clientDb = await getClientDbConnection(user.client.code);
    const tasks = await CrudHelper.findManyDetails(clientDb.task, { raisedTo: user.id }, 'AND', [], [], [], { skip: 0, limit: 5 });
    if (!tasks.length) {
      await sendWhatsappMessage(apiPhone, 'No tasks available to update.');
      await showMainMenu(apiPhone);
      return;
    }
    await createSession(dbPhone, { step: 'selectTaskForUpdate', tasks });
    const sections = [
      {
        title: 'Your Tasks',
        options: tasks.map((t) => ({
          type: 'text',
          title: t.taskTitle,
          id: String(t.id),
          postbackText: String(t.id),
          description: `Status: ${t.status} | Due: ${new Date(t.closeDate).toLocaleDateString('en-GB')}`
        }))
      }
    ];

    const listMessage = {
      type: 'list',
      title: 'Select Task',
      body: 'Please choose a task to update from the list below:',
      globalButtons: [{ type: 'text', title: 'Select Task' }],
      items: sections
    };
    await sendWhatsappMessage(apiPhone, JSON.stringify(listMessage));
    return;
  }

  if (updateSession.step === 'selectTaskForUpdate') {
    const choiceId = payload.postbackText;
    if (!choiceId) {
      await sendWhatsappMessage(apiPhone, 'Invalid choice. Please select a task from the list.');
      return;
    }
    const validTask = updateSession.tasks.find((t) => String(t.id) === String(choiceId));
    if (!validTask) {
      await sendWhatsappMessage(apiPhone, 'Task not found. Please try again.');
      return;
    }

    updateSession.selectedTaskId = validTask.id;
    updateSession.step = 'selectStatusForUpdate';
    await createSession(dbPhone, updateSession);

    const statuses = ['OPEN', 'RE_OPEN', 'HOLD', 'CLOSED'];
    const sections = [
      {
        title: 'Select New Status',
        options: statuses.map((s) => ({
          type: 'text',
          title: s,
          id: s,
          postbackText: s,
          description: `Set task status to ${s}`
        }))
      }
    ];

    const listMessage = {
      type: 'list',
      title: 'Update Status',
      body: `You selected *${validTask.taskTitle}* (ID: ${validTask.id}).\n\nChoose a new status:`,
      globalButtons: [{ type: 'text', title: 'Select Status' }],
      items: sections
    };
    await sendWhatsappMessage(apiPhone, JSON.stringify(listMessage));
    return;
  }

  if (updateSession.step === 'selectStatusForUpdate') {
    const choice = (payload?.postbackText || payload?.text || '').trim().toUpperCase();
    const allowedStatuses = ['OPEN', 'RE_OPEN', 'HOLD', 'CLOSED'];

    if (!allowedStatuses.includes(choice)) {
      await sendWhatsappMessage(apiPhone, 'Invalid choice. Please select from the list.');
      return;
    }

    const clientDb = await getClientDbConnection(user.client.code);
    await CrudHelper.updateOne(clientDb.task, { id: updateSession.selectedTaskId }, { status: choice });

    await sendWhatsappMessage(apiPhone, `Task ${updateSession.selectedTaskId} updated to *${choice}*`);
    await destroySession(dbPhone);
    await showMainMenu(apiPhone);
    return;
  }
}

module.exports = { sendWhatsappMessage, showMainMenu, handleAssignTaskFlow, handleViewTaskFlow, handleUpdateTaskFlow };
