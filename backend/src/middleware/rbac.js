/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin', 'accountant')
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Impersonation guard: block destructive actions for impersonated sessions
        if (req.user.isImpersonated) {
            const destructiveMethods = ['PUT', 'POST', 'PATCH', 'DELETE'];
            if (destructiveMethods.includes(req.method)) {
                return res.status(403).json({
                    error: 'Destructive actions are disabled during impersonation',
                });
            }
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { requireRole };
