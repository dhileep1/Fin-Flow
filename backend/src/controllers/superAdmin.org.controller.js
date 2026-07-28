const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { v4: uuidv4 } = require('uuid');

/**
 * List all organizations with aggregated metrics.
 * Returns: org details + activeLoans count, totalOutstanding, totalCustomers
 */
async function listOrgs(req, res, next) {
    try {
        const orgs = await prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // Aggregate metrics per org in parallel
        const orgsWithMetrics = await Promise.all(
            orgs.map(async (org) => {
                const [loanStats, customerCount, notificationCount] = await Promise.all([
                    prisma.loan.aggregate({
                        where: { orgId: org.id, status: 'active' },
                        _count: { id: true },
                        _sum: { outstandingPrincipal: true },
                    }),
                    prisma.customer.count({ where: { orgId: org.id } }),
                    prisma.notification.count({ where: { orgId: org.id, status: 'sent' } }),
                ]);

                return {
                    ...org,
                    metrics: {
                        activeLoans: loanStats._count.id,
                        totalOutstanding: loanStats._sum.outstandingPrincipal || 0,
                        totalCustomers: customerCount,
                        whatsappSent: notificationCount,
                    },
                };
            })
        );

        res.json({ orgs: orgsWithMetrics });
    } catch (err) {
        next(err);
    }
}

/**
 * Provision a new organization with default settings and first admin user.
 */
async function provisionOrg(req, res, next) {
    try {
        const { name, phone, address, adminName, adminEmail, adminPassword } = req.body;

        if (!name || !adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({
                error: 'name, adminName, adminEmail, and adminPassword are required',
            });
        }

        // Create org and admin user in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const orgId = uuidv4();
            const org = await tx.organization.create({
                data: {
                    id: orgId,
                    name,
                    phone: phone || null,
                    address: address || null,
                    status: 'active',
                    settings: {
                        interest_on: 'gross_principal',
                        penalty_compounding: false,
                        payment_application_order: ['penalty', 'interest', 'principal'],
                        notification_cadence: { reminder_days_before: [7, 1, 0] },
                    },
                },
            });

            const passwordHash = await bcrypt.hash(adminPassword, 12);
            const adminUser = await tx.user.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    name: adminName,
                    email: adminEmail.trim().toLowerCase(),
                    passwordHash,
                    role: 'admin',
                    status: 'active',
                },
            });

            return { org, adminUser };
        });

        // Log the provisioning action
        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: req.user.id,
                targetOrgId: result.org.id,
                action: 'PROVISION_ORG',
                ipAddress: req.ip,
                details: { orgName: name, adminEmail },
            },
        });

        res.status(201).json({
            org: result.org,
            adminUser: {
                id: result.adminUser.id,
                name: result.adminUser.name,
                email: result.adminUser.email,
                role: result.adminUser.role,
            },
        });
    } catch (err) {
        // Handle unique constraint violations
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Admin email already exists in this organization' });
        }
        next(err);
    }
}

/**
 * Update organization status (active, suspended, decommissioned).
 */
async function updateOrgStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const validStatuses = ['active', 'suspended', 'decommissioned'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: `status must be one of: ${validStatuses.join(', ')}`,
            });
        }

        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const updated = await prisma.organization.update({
            where: { id },
            data: { status },
        });

        // Audit log
        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: req.user.id,
                targetOrgId: id,
                action: 'UPDATE_ORG_STATUS',
                reason: reason || null,
                ipAddress: req.ip,
                details: { previousStatus: org.status, newStatus: status },
            },
        });

        res.json({ org: updated });
    } catch (err) {
        next(err);
    }
}

/**
 * Impersonate a tenant organization.
 * Issues a short-lived (1 hour) tenant JWT with isImpersonated: true.
 * The super-admin can then use this token to browse the tenant's cockpit in read-only mode.
 */
async function impersonate(req, res, next) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length < 3) {
            return res.status(400).json({ error: 'A reason for impersonation is required (min 3 chars)' });
        }

        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Find the first admin user for this org to get a realistic user context
        const adminUser = await prisma.user.findFirst({
            where: { orgId: id, role: 'admin', status: 'active' },
        });

        if (!adminUser) {
            return res.status(404).json({ error: 'No active admin user found for this organization' });
        }

        // Issue a short-lived impersonation token
        const impersonationToken = jwt.sign(
            {
                id: adminUser.id,
                orgId: id,
                role: adminUser.role,
                name: `${req.user.name} (as ${adminUser.name})`,
                isImpersonated: true,
                superAdminId: req.user.id,
            },
            config.jwtSecret,
            { expiresIn: '1h' }
        );

        // Audit log
        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: req.user.id,
                targetOrgId: id,
                action: 'IMPERSONATE_ORG',
                reason: reason.trim(),
                ipAddress: req.ip,
                details: { orgName: org.name, impersonatedUserId: adminUser.id },
            },
        });

        res.json({
            token: impersonationToken,
            orgId: id,
            orgName: org.name,
            user: {
                id: adminUser.id,
                name: adminUser.name,
                role: adminUser.role,
                orgId: id,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get global platform KPIs for the super-admin dashboard.
 */
async function getDashboardStats(req, res, next) {
    try {
        const [
            totalOrgs,
            totalActiveLoans,
            totalOutstanding,
            totalWhatsappSent,
        ] = await Promise.all([
            prisma.organization.count(),
            prisma.loan.count({ where: { status: 'active' } }),
            prisma.loan.aggregate({
                where: { status: 'active' },
                _sum: { outstandingPrincipal: true },
            }),
            prisma.notification.count({ where: { status: 'sent' } }),
        ]);

        res.json({
            totalOrgs,
            totalActiveLoans,
            totalOutstanding: totalOutstanding._sum.outstandingPrincipal || 0,
            totalWhatsappSent,
        });
    } catch (err) {
        next(err);
    }
}

async function resetUserPassword(req, res, next) {
    try {
        const { userId } = req.params;
        const { newPassword, approveOnly } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (approveOnly) {
            await prisma.user.update({
                where: { id: userId },
                data: { resetApprovedBySuperAdmin: true },
            });
            return res.json({ message: 'Password reset approved for user' });
        }

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                resetOtp: null,
                resetOtpExpiresAt: null,
                resetApprovedBySuperAdmin: false,
            },
        });

        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: req.user.id,
                targetOrgId: user.orgId,
                action: 'SUPER_ADMIN_RESET_PASSWORD',
                ipAddress: req.ip,
                details: { targetUserId: user.id, userEmail: user.email },
            },
        });

        res.json({ message: 'User password reset successfully by SuperAdmin' });
    } catch (err) {
        next(err);
    }
}

module.exports = { listOrgs, provisionOrg, updateOrgStatus, impersonate, getDashboardStats, resetUserPassword };
