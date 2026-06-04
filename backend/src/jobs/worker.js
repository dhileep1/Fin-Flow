const { runPenaltyJob } = require('./penaltyJob');
const { runNotificationScheduler } = require('./notificationScheduler');
const { runCallTaskRefresher } = require('./callTaskRefresher');

/**
 * Simple scheduler using setInterval.
 * For production, replace with BullMQ repeatable jobs or a proper scheduler.
 */
function startWorkers() {
    console.log('[Workers] Starting background job scheduler...');

    // Penalty job — daily at startup + every 24 hours
    // In production: use cron at 00:05 local timezone
    setTimeout(() => {
        runPenaltyJob().catch(console.error);
    }, 5000);

    setInterval(() => {
        runPenaltyJob().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    // Call task refresher — on startup + every 24 hours
    setTimeout(() => {
        runCallTaskRefresher().catch(console.error);
    }, 10000);

    setInterval(() => {
        runCallTaskRefresher().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    // Notification scheduler — every 5 minutes
    setInterval(() => {
        runNotificationScheduler().catch(console.error);
    }, 5 * 60 * 1000);

    console.log('[Workers] Background jobs scheduled');
}

module.exports = { startWorkers };
