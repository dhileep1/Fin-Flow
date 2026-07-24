const { PrismaClient } = require('@prisma/client');

// MOD-5: Configure connection pooling for production workloads
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

// Graceful connection testing on startup
prisma.$connect()
    .then(() => {
        if (process.env.NODE_ENV !== 'test') {
            console.log('[Database] Connected successfully');
        }
    })
    .catch((err) => {
        console.error('[Database] Connection failed:', err.message);
    });

module.exports = prisma;
