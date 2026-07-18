const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config/env');
const { runPenaltyJob } = require('./penaltyJob');
const { runNotificationScheduler } = require('./notificationScheduler');
const { runCallTaskRefresher } = require('./callTaskRefresher');
const logger = require('../utils/logger');

let connection = null;
let jobsQueue = null;
let worker = null;
const fallbackTimerIds = [];

let connectionErrorLogged = false;

function initBullMQ() {
    try {
        logger.info('[BullMQ] Connecting to Redis at: ' + config.redisUrl);
        connection = new Redis(config.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            connectTimeout: 5000,
        });

        connection.on('error', (err) => {
            if (!connectionErrorLogged) {
                logger.warn('[BullMQ] Redis connection error, falling back to interval scheduler: ' + err.message);
                connectionErrorLogged = true;
            }
            startIntervalFallback();
        });

        connection.on('connect', async () => {
            logger.info('[BullMQ] Connected to Redis. Setting up queues and workers...');
            connectionErrorLogged = false;
            setupBullMQQueuesAndWorkers();
        });
    } catch (err) {
        logger.warn('[BullMQ] Failed to initialize Redis connection. Falling back to interval scheduler: ' + err.message);
        startIntervalFallback();
    }
}

async function setupBullMQQueuesAndWorkers() {
    try {
        // Clear any running fallback intervals
        try {
            clearFallbackIntervals();
        } catch (e) {
            logger.warn('Failed to clear fallback timers: ' + e.message);
        }

        jobsQueue = new Queue('finflow-jobs', { connection });

        // Add repeatable jobs:
        // 1. Penalty Job - daily at 00:05 (cron: '5 0 * * *')
        await jobsQueue.add('penalty-job', {}, {
            repeat: { pattern: '5 0 * * *' }
        });

        // 2. Call Task Refresher - daily at 00:10 (cron: '10 0 * * *')
        await jobsQueue.add('call-task-refresher', {}, {
            repeat: { pattern: '10 0 * * *' }
        });

        // 3. Notification Scheduler - every 5 minutes (cron: '*/5 * * * *')
        await jobsQueue.add('notification-scheduler', {}, {
            repeat: { pattern: '*/5 * * * *' }
        });

        logger.info('[BullMQ] Repeatable jobs successfully registered in Redis');

        worker = new Worker('finflow-jobs', async (job) => {
            logger.info(`[BullMQ Worker] Processing job: ${job.name}`);
            if (job.name === 'penalty-job') {
                await runPenaltyJob();
            } else if (job.name === 'call-task-refresher') {
                await runCallTaskRefresher();
            } else if (job.name === 'notification-scheduler') {
                await runNotificationScheduler();
            }
        }, { connection });

        worker.on('failed', (job, err) => {
            logger.error(`[BullMQ Worker] Job ${job.name} failed`, { message: err.message, stack: err.stack });
        });

        worker.on('completed', (job) => {
            logger.info(`[BullMQ Worker] Job ${job.name} completed successfully`);
        });

    } catch (err) {
        logger.error('[BullMQ] Error setting up queues and workers, falling back: ' + err.message);
        startIntervalFallback();
    }
}

function clearFallbackIntervals() {
    while (fallbackTimerIds.length > 0) {
        const id = fallbackTimerIds.pop();
        clearInterval(id);
        clearTimeout(id);
    }
}

function startIntervalFallback() {
    if (fallbackTimerIds.length > 0) return; // already running

    logger.info('[Workers Fallback] Starting simple setInterval scheduler...');

    // Run penalty job daily
    fallbackTimerIds.push(setTimeout(async () => {
        try {
            await runPenaltyJob();
        } catch (err) {
            logger.error('[Workers Fallback] Penalty job failed', { message: err.message, stack: err.stack });
        }
    }, 5000));
    fallbackTimerIds.push(setInterval(async () => {
        try {
            await runPenaltyJob();
        } catch (err) {
            logger.error('[Workers Fallback] Penalty job failed', { message: err.message, stack: err.stack });
        }
    }, 24 * 60 * 60 * 1000));

    // Run call task refresher daily
    fallbackTimerIds.push(setTimeout(async () => {
        try {
            await runCallTaskRefresher();
        } catch (err) {
            logger.error('[Workers Fallback] Call task refresher failed', { message: err.message, stack: err.stack });
        }
    }, 10000));
    fallbackTimerIds.push(setInterval(async () => {
        try {
            await runCallTaskRefresher();
        } catch (err) {
            logger.error('[Workers Fallback] Call task refresher failed', { message: err.message, stack: err.stack });
        }
    }, 24 * 60 * 60 * 1000));

    // Run notification scheduler every 5 minutes
    fallbackTimerIds.push(setInterval(async () => {
        try {
            await runNotificationScheduler();
        } catch (err) {
            logger.error('[Workers Fallback] Notification scheduler failed', { message: err.message, stack: err.stack });
        }
    }, 5 * 60 * 1000));

    logger.info('[Workers Fallback] Simple scheduler initiated');
}

function startWorkers() {
    initBullMQ();
}

async function stopWorkers() {
    try {
        clearFallbackIntervals();
    } catch (e) {
        logger.warn('Failed to clear fallback timers: ' + e.message);
    }
    if (worker) {
        await worker.close().catch(() => {});
        worker = null;
    }
    if (jobsQueue) {
        await jobsQueue.close().catch(() => {});
        jobsQueue = null;
    }
    if (connection) {
        await connection.quit().catch(() => {});
        connection = null;
    }
}

module.exports = { startWorkers, stopWorkers };
