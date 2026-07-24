const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Call task refresher — runs daily at 00:10.
 * Marks call tasks with next_call_date <= today as available.
 */
async function runCallTaskRefresher() {
    logger.info('[CallTaskRefresher] Refreshing call tasks...');
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Mark dues with dueDate < today and not paid as 'overdue'
        //    BIZ-10: Only mark as overdue if no partial payment — partially-paid stay 'pending'
        const overdueUpdate = await prisma.loanDue.updateMany({
            where: {
                status: { in: ['upcoming', 'pending'] },
                dueDate: { lt: today },
                amountPaid: { lte: 0 }
            },
            data: { status: 'overdue' }
        });

        // Mark partially-paid past-due as 'pending' (not overdue) so they remain actionable
        const partialPaidUpdate = await prisma.loanDue.updateMany({
            where: {
                status: 'upcoming',
                dueDate: { lt: today },
                amountPaid: { gt: 0 }
            },
            data: { status: 'pending' }
        });

        // 2. Mark dues with dueDate === today and status === 'upcoming' as 'pending'
        const pendingUpdate = await prisma.loanDue.updateMany({
            where: {
                status: 'upcoming',
                dueDate: today
            },
            data: { status: 'pending' }
        });

        logger.info(`[CallTaskRefresher] Updated ${overdueUpdate.count} dues to overdue, ${pendingUpdate.count} dues to pending`);

        // Count tasks ready for follow-up
        const readyTasks = await prisma.callTask.count({
            where: {
                nextCallDate: { lte: today },
            },
        });

        logger.info(`[CallTaskRefresher] ${readyTasks} call tasks ready for follow-up`);
        return { duesUpdated: overdueUpdate.count + pendingUpdate.count, readyTasks };
    } catch (err) {
        logger.error('[CallTaskRefresher] Failed', { error: err.message, stack: err.stack });
        throw err;
    }
}

module.exports = { runCallTaskRefresher };
