const notificationService = require('../services/notification.service');

async function sendNotification(req, res, next) {
    try {
        const { customerId, loanId, type, messageBody, mediaUrl } = req.body;
        if (!customerId || !messageBody) {
            return res.status(400).json({ error: 'customerId and messageBody are required' });
        }

        const result = await notificationService.sendNotification({
            orgId: req.orgId,
            customerId,
            loanId,
            type: type || 'manual',
            messageBody,
            mediaUrl,
        });

        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
}

async function handleWebhook(req, res, next) {
    try {
        const { providerMessageId, status } = req.body;
        await notificationService.handleWebhook(providerMessageId, status);
        res.json({ received: true });
    } catch (err) {
        next(err);
    }
}

module.exports = { sendNotification, handleWebhook };
