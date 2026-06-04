/**
 * Tenant scoping middleware.
 * Validates org_id from URL params matches user's org, then injects orgId for downstream use.
 */
function tenantScope(req, res, next) {
    const orgId = req.params.orgId;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Ensure user belongs to this org (unless super-admin)
    if (req.user && req.user.role !== 'super_admin' && req.user.orgId !== orgId) {
        return res.status(403).json({ error: 'Access denied to this organization' });
    }

    req.orgId = orgId;
    next();
}

module.exports = { tenantScope };
