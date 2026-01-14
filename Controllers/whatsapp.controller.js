const CrudHelper = require('../Helpers/crud.helper');
const Logger = require('../Helpers/logger');
const Response = require('../Helpers/response.helper');
const { PrismaClient } = require('@prisma/client');
const { sendWhatsappMessage, showMainMenu, handleAssignTaskFlow, handleViewTaskFlow, handleUpdateTaskFlow } = require('../Services/whatsapp.service');
const { createSession, getSession, refreshSession, destroySession } = require('../Helpers/redis.helper');
const { INITIAL_REDIS_DATA, ASSIGN_STEPS, UPDATE_STEPS } = require('../Constants/constant');

const prisma = new PrismaClient();
const TIMEOUT = 5 * 60;

// MAIN WEBHOOK HANDLER
async function webhookwhatsapp(req, res) {
    try {
        const event = req.body;
        const rawPhone = event?.payload?.sender?.phone;
        const payload = event?.payload?.payload;

        if (!rawPhone) {
            return Response.success(res, { message: 'OK' });
        }

        const dbPhone = rawPhone.replace(/^91/, '');
        const apiPhone = dbPhone.startsWith('91') ? dbPhone : '91' + dbPhone;

        const user = await CrudHelper.read(prisma.user, { whatsAppNo: dbPhone }, ['client', 'id', 'name']);
        if (!user) {
            return Response.success(res, {
                message: 'OK'
            });
        }

        let session = await getSession(dbPhone);

        if (session) {
            await refreshSession(dbPhone, TIMEOUT);
        }

        if (
            !session &&
            (INITIAL_REDIS_DATA.includes(payload?.text) || INITIAL_REDIS_DATA.includes(payload?.title))
        ) {
            await createSession(dbPhone);
        }

        if (
            payload?.text === 'Assign Task' ||
            payload?.title === 'Assign Task' ||
            ASSIGN_STEPS.some(step => session?.step?.startsWith(step))
        ) {
            await handleAssignTaskFlow(payload, event, apiPhone, dbPhone, user);
            return Response.success(res, {
                message: 'OK'
            });
        }

        if (
            payload?.text === 'View Task' ||
            payload?.title === 'View Task' ||
            payload?.title === 'Raised Tasks' ||
            payload?.title === 'Recieved Tasks'
        ) {
            await handleViewTaskFlow(payload, apiPhone, user);
            return Response.success(res, { message: 'OK' });
        }

        if (payload?.text === 'Update Task' || payload?.title === 'Update Task' || UPDATE_STEPS.some(step => session?.step?.startsWith(step))

        ) {
            await handleUpdateTaskFlow(payload, apiPhone, dbPhone, user);
            return Response.success(res, { message: 'OK' });
        }

        if (event?.payload?.payload?.text === 'Manage Tasks via WA') {
            const phone = event?.payload?.sender?.phone;
            const apiPhone = phone.startsWith('91') ? phone : '91' + phone;
            await showMainMenu(apiPhone);
            return Response.success(res, { message: 'OK' });
        }

        if (!session) {
            await sendWhatsappMessage(apiPhone, 'Your session has expired. Please start again.');
            await showMainMenu(apiPhone);
            return Response.success(res, {
                message: 'OK'
            });
        } else {
            await sendWhatsappMessage(apiPhone, "Sorry, I didn't understand that.");
            await showMainMenu(apiPhone);
            await destroySession(dbPhone);
        }
        return Response.success(res, {
            message: 'OK'
        });

    } catch (err) {
        Logger.error('Webhook Error: ' + err.message);
        await destroySession(req.body.payload?.sender?.phone);
        return Response.error(res, {
            message: 'Internal Server Error'
        });
    }
}

module.exports = { webhookwhatsapp };
