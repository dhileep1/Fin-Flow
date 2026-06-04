const prisma = require('../config/database');

/**
 * Call task refresher — runs daily at 00:10.
 * Marks call tasks with next_call_date <= today as available.
 */
async function runCallTaskRefresher() {
    console.log('[CallTaskRefresher] Refreshing call tasks...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update dues status: mark as pending if due_date <= today and not paid
    const dueStatusUpdate = await prisma.loanDue.updateMany({
        where: {
            status: 'upcoming',
            dueDate: { lte: today },
        },
        data: { status: 'pending' },
    });

    console.log(`[CallTaskRefresher] Updated ${dueStatusUpdate.count} dues to pending`);

    // Count tasks ready for follow-up
    const readyTasks = await prisma.callTask.count({
        where: {
            nextCallDate: { lte: today },
        },
    });

    console.log(`[CallTaskRefresher] ${readyTasks} call tasks ready for follow-up`);
    return { duesUpdated: dueStatusUpdate.count, readyTasks };
}

module.exports = { runCallTaskRefresher };
