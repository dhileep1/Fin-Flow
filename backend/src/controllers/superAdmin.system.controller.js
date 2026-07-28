const prisma = require('../config/database');
const config = require('../config/env');
const Redis = require('ioredis');
const { Queue } = require('bullmq');

/**
 * System health check.
 * Pings the database and Redis, returns their status.
 */
async function getSystemHealth(req, res, next) {
    try {
        // Database health
        let dbStatus = 'healthy';
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (err) {
            dbStatus = `unhealthy: ${err.message}`;
        }

        // Redis health
        let redisStatus = 'healthy';
        let redisClient = null;
        try {
            redisClient = new Redis(config.redisUrl, {
                connectTimeout: 3000,
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                enableReadyCheck: false,
            });
            redisClient.on('error', () => {}); // suppress
            await redisClient.connect();
            await redisClient.ping();
        } catch (err) {
            redisStatus = `unhealthy: ${err.message}`;
        } finally {
            if (redisClient) {
                try { await redisClient.quit(); } catch { /* ignore */ }
            }
        }

        const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

        res.json({
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                database: dbStatus,
                redis: redisStatus,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get BullMQ queue statistics.
 * Creates a read-only Queue connection to the existing finflow-jobs queue.
 */
async function getQueueStats(req, res, next) {
    let connection = null;
    let queue = null;
    try {
        connection = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            retryStrategy: () => false,
        });
        connection.on('error', () => {}); // suppress

        queue = new Queue('finflow-jobs', { connection });
        const counts = await queue.getJobCounts(
            'active', 'waiting', 'completed', 'failed', 'delayed', 'paused'
        );

        res.json({
            queueName: 'finflow-jobs',
            counts,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        // If Redis is unreachable, return a graceful response
        res.json({
            queueName: 'finflow-jobs',
            error: 'Unable to connect to queue: Redis server is unreachable',
            counts: null,
        });
    } finally {
        if (queue) {
            queue.close().catch(() => {});
        }
        if (connection) {
            try { connection.disconnect(); } catch { /* ignore */ }
        }
    }
}

/**
 * Retry all failed jobs in the BullMQ queue.
 */
async function retryFailedJobs(req, res, next) {
    let connection = null;
    let queue = null;
    try {
        connection = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            retryStrategy: () => false,
        });
        connection.on('error', () => {}); // suppress

        queue = new Queue('finflow-jobs', { connection });

        const failedJobs = await queue.getFailed(0, 100);
        let retriedCount = 0;

        for (const job of failedJobs) {
            try {
                await job.retry();
                retriedCount++;
            } catch (e) {
                // Some jobs may not be retryable — skip
            }
        }

        // Audit log
        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: req.user.id,
                action: 'RETRY_FAILED_JOBS',
                ipAddress: req.ip,
                details: { totalFailed: failedJobs.length, retriedCount },
            },
        });

        res.json({
            message: `Retried ${retriedCount} of ${failedJobs.length} failed jobs`,
            retriedCount,
            totalFailed: failedJobs.length,
        });
    } catch (err) {
        res.json({
            error: 'Unable to retry jobs: Redis server is unreachable',
        });
    } finally {
        if (queue) {
            queue.close().catch(() => {});
        }
        if (connection) {
            try { connection.disconnect(); } catch { /* ignore */ }
        }
    }
}

module.exports = { getSystemHealth, getQueueStats, retryFailedJobs };
