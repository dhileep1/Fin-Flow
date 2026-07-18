const prisma = require('../config/database');
const logger = require('../utils/logger');
const { sendNotification } = require('../services/notification.service');

/**
 * Notification scheduler — runs every 5 minutes.
 * Enqueues upcoming due reminders (T-7, T-1, T+0, overdue).
 */
async function runNotificationScheduler() {
    logger.info('[NotificationScheduler] Checking for pending notifications...');
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find dues needing reminders
        const upcomingDues = await prisma.loanDue.findMany({
            where: {
                status: { not: 'paid' },
                dueDate: {
                    gte: today,
                    lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
                },
            },
            include: {
                loan: {
                    include: {
                        customer: true,
                        org: true,
                    },
                },
            },
        });

        let enqueued = 0;
        for (const due of upcomingDues) {
            const customer = due.loan.customer;
            if (customer.optOutWhatsapp) continue;

            // Check if notification was already sent today for this due
            const existing = await prisma.notification.findFirst({
                where: {
                    loanId: due.loanId,
                    customerId: customer.id,
                    type: 'reminder',
                    createdAt: { gte: today },
                },
            });

            if (existing) continue;

            await sendNotification({
                orgId: due.orgId,
                customerId: customer.id,
                loanId: due.loanId,
                type: 'reminder',
                messageBody: `Dear ${customer.name}, your EMI of ₹${Number(due.totalDue).toFixed(2)} is due on ${new Date(due.dueDate).toLocaleDateString('en-IN')}. Please pay on time to avoid penalties. - ${due.loan.org?.name || 'Lend Easy'}`
            });
            enqueued++;
        }

        logger.info(`[NotificationScheduler] Enqueued ${enqueued} notifications`);
        return { enqueued };
    } catch (err) {
        logger.error('[NotificationScheduler] Failed', { error: err.message, stack: err.stack });
        throw err;
    }
}

module.exports = { runNotificationScheduler };
