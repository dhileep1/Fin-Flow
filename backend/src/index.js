require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { startWorkers, stopWorkers } = require('./jobs/worker');
const prisma = require('./config/database');
const Redis = require('ioredis');
const logger = require('./utils/logger');

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(cors({ origin: config.corsAllowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting configurations
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.nodeEnv === 'development' ? 10000 : 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.nodeEnv === 'development' ? 1000 : 10, // Limit each IP to 10 login attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

// Apply rate limiters
app.use('/api', globalLimiter);

// --- Health check helper functions ---
async function checkDbHealth() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return 'healthy';
    } catch (err) {
        return `unhealthy: ${err.message}`;
    }
}

async function checkRedisHealth() {
    return new Promise((resolve) => {
        const client = new Redis(config.redisUrl, {
            connectTimeout: 1000,
            maxRetriesPerRequest: 1
        });
        client.ping()
            .then(() => {
                client.disconnect();
                resolve('healthy');
            })
            .catch((err) => {
                resolve(`unhealthy: ${err.message}`);
            });
    });
}

// --- Health check ---
app.get('/api/health', async (req, res) => {
    const dbStatus = await checkDbHealth();
    const redisStatus = await checkRedisHealth();
    const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus,
            redis: redisStatus
        }
    });
});

// --- API Routes ---
const API_PREFIX = '/api/v1/:orgId';

app.use(`${API_PREFIX}/auth/login`, authLimiter);
app.use(`${API_PREFIX}/auth`, require('./routes/auth.routes'));
app.use(`${API_PREFIX}/customers`, require('./routes/customer.routes'));
app.use(`${API_PREFIX}/vehicles`, require('./routes/vehicle.routes'));
app.use(`${API_PREFIX}/seizures`, require('./routes/seizure.routes'));
app.use(`${API_PREFIX}/loans`, require('./routes/loan.routes'));
app.use(`${API_PREFIX}/payments`, require('./routes/payment.routes'));
app.use(`${API_PREFIX}/expenses`, require('./routes/expense.routes'));
app.use(`${API_PREFIX}/call-tasks`, require('./routes/callTask.routes'));
app.use(`${API_PREFIX}/notifications`, require('./routes/notification.routes'));
app.use(`${API_PREFIX}/reports`, require('./routes/report.routes'));
app.use(`${API_PREFIX}/search`, require('./routes/search.routes'));
app.use(`${API_PREFIX}/admin`, require('./routes/admin.routes'));

// --- Error handler ---
app.use(errorHandler);

// --- Start server ---
const PORT = config.port;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API: http://localhost:${PORT}/api/v1/{orgId}`);

    // Start background workers
    if (config.nodeEnv !== 'test') {
        startWorkers();
    }
});

// --- Graceful Shutdown ---
let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new requests (Express server)
    if (server) {
        server.close(() => {
            logger.info('HTTP server closed.');
        });
    }

    // Stop background queue workers/schedulers
    try {
        await stopWorkers();
        logger.info('Background workers stopped.');
    } catch (err) {
        logger.error('Error stopping background workers:', err);
    }

    // Close database connections
    try {
        await prisma.$disconnect();
        logger.info('Database connection closed.');
    } catch (err) {
        logger.error('Error disconnecting from database:', err);
    }

    logger.info('Graceful shutdown completed.');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

