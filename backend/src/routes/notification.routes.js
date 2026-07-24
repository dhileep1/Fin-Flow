const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { sendNotificationSchema, bulkSendNotificationsSchema } = require('../utils/validation.schemas');
const prisma = require('../config/database');
const { sendNotification } = require('../services/notification.service');
const notificationController = require('../controllers/notification.controller');
const router = express.Router({ mergeParams: true });

// PUBLIC Webhook callback (bypasses auth and tenant scope for Twilio callbacks)
router.post('/webhook', async (req, res, next) => {
    try {
        // SEC-4: Verify Twilio webhook signature when using Twilio provider
        const env = require('../config/env');
        if (env.whatsappProvider === 'twilio' && env.twilioAuthToken) {
            const twilioLib = require('twilio');
            const signature = req.headers['x-twilio-signature'];
            const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
            const isValid = twilioLib.validateRequest(
                env.twilioAuthToken,
                signature || '',
                url,
                req.body || {}
            );
            if (!isValid) {
                return res.status(403).json({ error: 'Invalid webhook signature' });
            }
        }

        const { MessageSid, MessageStatus, SmsStatus, SmsSid } = req.body;
        const sid = MessageSid || SmsSid;
        const status = MessageStatus || SmsStatus;
        
        if (sid && status) {
            const { handleWebhook } = require('../services/notification.service');
            await handleWebhook(sid, status.toLowerCase());
        }
        return res.status(200).send('OK');
    } catch (err) {
        next(err);
    }
});

router.use(authenticate, tenantScope);

/**
 * GET /api/v1/:orgId/notifications/targets
 * Get customers based on loan status and overdue filters
 */
router.get('/targets', async (req, res, next) => {
    try {
        const { loanStatus, overdue } = req.query;
        const where = { orgId: req.orgId };

        if (loanStatus || overdue === 'true') {
            where.loans = {
                some: {
                    ...(loanStatus ? { status: loanStatus } : {}),
                    ...(overdue === 'true' ? { status: { not: 'closed' }, nextDueDate: { lt: new Date() } } : {}),
                }
            };
        }

        const targets = await prisma.customer.findMany({
            where,
            include: {
                loans: {
                    include: {
                        loanDues: {
                            where: { status: { not: 'paid' } },
                            orderBy: { dueDate: 'asc' }
                        }
                    }
                }
            }
        });

        res.json({ targets });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/:orgId/notifications/send
 * Send single notification
 */
router.post('/send', requireRole('admin', 'accountant'), validate(sendNotificationSchema), notificationController.sendNotification);

/**
 * POST /api/v1/:orgId/notifications/bulk-send
 * Send message to multiple customers
 */
router.post('/bulk-send', requireRole('admin', 'accountant'), validate(bulkSendNotificationsSchema), async (req, res, next) => {
    try {
        const { targetIds, messageBody } = req.body;
        if (!targetIds || !Array.isArray(targetIds) || !messageBody) {
            return res.status(400).json({ error: 'Missing targetIds or messageBody' });
        }

        let successCount = 0;
        let failedCount = 0;

        for (const customerId of targetIds) {
            try {
                const result = await sendNotification({
                    orgId: req.orgId,
                    customerId,
                    type: 'manual',
                    messageBody,
                });
                if (result.success) successCount++;
                else failedCount++;
            } catch (e) {
                failedCount++;
            }
        }

        res.json({ successCount, failedCount });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
