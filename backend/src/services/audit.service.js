const prisma = require('../config/database');

/**
 * Create an audit log entry.
 */
async function logAudit({ orgId, userId, action, entityType, entityId, details }) {
    return prisma.auditLog.create({
        data: {
            orgId,
            userId,
            action,
            entityType,
            entityId,
            details: details || {},
        },
    });
}

module.exports = { logAudit };
