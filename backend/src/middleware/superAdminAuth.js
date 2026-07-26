const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/database');

/**
 * Super-Admin JWT authentication middleware.
 * Verifies the token carries `isSuperAdmin: true` and that
 * the referenced SuperAdminUser exists and is active.
 */
async function superAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtSecret);

        // Reject regular tenant tokens
        if (!decoded.isSuperAdmin) {
            return res.status(403).json({ error: 'Super-Admin access required' });
        }

        // Verify the super-admin user still exists and is active
        const superAdmin = await prisma.superAdminUser.findUnique({
            where: { id: decoded.id },
        });

        if (!superAdmin || superAdmin.status !== 'active') {
            return res.status(403).json({ error: 'Super-Admin account is inactive or not found' });
        }

        req.user = {
            id: superAdmin.id,
            name: superAdmin.name,
            email: superAdmin.email,
            role: superAdmin.role,
            isSuperAdmin: true,
        };

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = { superAdminAuth };
