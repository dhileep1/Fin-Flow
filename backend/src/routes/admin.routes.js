const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const { encrypt, decrypt } = require('../utils/encryption');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

// --- Organization settings ---
router.get('/settings', requireRole('admin'), async (req, res, next) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.orgId } });
        res.json(org);
    } catch (err) { next(err); }
});

router.put('/settings', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, address, startingCash, penaltyRate, documentFeePercent, gracePeriodDays, allocationOrder } = req.body;
        const oldOrg = await prisma.organization.findUnique({
            where: { id: req.orgId }
        });
        
        const settings = {
            ...(oldOrg.settings || {}),
            startingCash: startingCash !== undefined ? Number(startingCash) : (oldOrg.settings?.startingCash || 0),
            penaltyRate: penaltyRate !== undefined ? Number(penaltyRate) : (oldOrg.settings?.penaltyRate || 0.00002),
            documentFeePercent: documentFeePercent !== undefined ? Number(documentFeePercent) : (oldOrg.settings?.documentFeePercent || 0.05),
            gracePeriodDays: gracePeriodDays !== undefined ? Number(gracePeriodDays) : (oldOrg.settings?.gracePeriodDays || 0),
            allocationOrder: allocationOrder !== undefined ? allocationOrder : (oldOrg.settings?.allocationOrder || ['penalty', 'interest', 'principal'])
        };

        const org = await prisma.organization.update({
            where: { id: req.orgId },
            data: { name, phone, address, settings },
        });

        const { logAudit } = require('../services/audit.service');
        await logAudit({
            orgId: req.orgId,
            userId: req.user.id,
            action: 'org_settings_updated',
            entityType: 'organization',
            entityId: req.orgId,
            details: {
                previous: { name: oldOrg.name, phone: oldOrg.phone, address: oldOrg.address, settings: oldOrg.settings },
                updated: { name, phone, address, settings }
            }
        });

        res.json(org);
    } catch (err) { next(err); }
});

// --- User management ---
router.get('/users', requireRole('admin'), async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { orgId: req.orgId },
            select: { id: true, name: true, phone: true, email: true, role: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) { next(err); }
});

router.post('/users', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, email, password, role } = req.body;
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { orgId: req.orgId, name, phone, email, passwordHash, role },
        });
        res.status(201).json({ id: user.id, name: user.name, role: user.role });
    } catch (err) { next(err); }
});

router.put('/users/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, email, role, status, password } = req.body;
        const data = { name, phone, email, role, status };
        if (password) data.passwordHash = await bcrypt.hash(password, 12);
        await prisma.user.updateMany({
            where: { id: req.params.id, orgId: req.orgId },
            data,
        });
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        res.json({ id: user.id, name: user.name, role: user.role, status: user.status });
    } catch (err) { next(err); }
});

// --- Audit/History Log ---
router.get('/audit-logs', requireRole('admin'), async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: { orgId: req.orgId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({
                where: { orgId: req.orgId }
            })
        ]);

        // Enrich with user name and role
        const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, role: true }
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        // Gather entity IDs for client resolution
        const customerIds = [...new Set(logs.filter(l => l.entityType === 'customer').map(l => l.entityId).filter(Boolean))];
        const loanIds = [...new Set(logs.filter(l => l.entityType === 'loan').map(l => l.entityId).filter(Boolean))];
        const paymentIds = [...new Set(logs.filter(l => l.entityType === 'payment').map(l => l.entityId).filter(Boolean))];
        const callLogIds = [...new Set(logs.filter(l => l.entityType === 'call_log').map(l => l.entityId).filter(Boolean))];
        const vehicleIds = [...new Set(logs.filter(l => l.entityType === 'vehicle').map(l => l.entityId).filter(Boolean))];

        const [dbCustomers, dbLoans, dbPayments, dbCallLogs, dbVehicles] = await Promise.all([
            prisma.customer.findMany({
                where: { id: { in: customerIds }, orgId: req.orgId },
                select: { id: true, name: true }
            }),
            prisma.loan.findMany({
                where: { id: { in: loanIds }, orgId: req.orgId },
                select: { id: true, customer: { select: { name: true } } }
            }),
            prisma.payment.findMany({
                where: { id: { in: paymentIds }, orgId: req.orgId },
                select: { id: true, loan: { select: { customer: { select: { name: true } } } } }
            }),
            prisma.callLog.findMany({
                where: { id: { in: callLogIds } },
                select: { id: true, callTask: { select: { loan: { select: { customer: { select: { name: true } } } } } } }
            }),
            prisma.vehicle.findMany({
                where: { id: { in: vehicleIds }, orgId: req.orgId },
                select: { id: true, customer: { select: { name: true } } }
            })
        ]);

        const clientNameMap = new Map();
        dbCustomers.forEach(c => clientNameMap.set(c.id, c.name));
        dbLoans.forEach(l => clientNameMap.set(l.id, l.customer?.name));
        dbPayments.forEach(p => clientNameMap.set(p.id, p.loan?.customer?.name));
        dbCallLogs.forEach(cl => clientNameMap.set(cl.id, cl.callTask?.loan?.customer?.name));
        dbVehicles.forEach(v => clientNameMap.set(v.id, v.customer?.name));

        const enrichedLogs = logs.map(log => ({
            ...log,
            user: userMap.get(log.userId) || { name: 'System', role: 'system' },
            clientName: clientNameMap.get(log.entityId) || '—'
        }));

        res.json({
            logs: enrichedLogs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        next(err);
    }
});

router.post('/audit-logs/:id/revert', requireRole('admin'), async (req, res, next) => {
    try {
        const log = await prisma.auditLog.findFirst({
            where: { id: req.params.id, orgId: req.orgId }
        });

        if (!log) {
            return res.status(404).json({ error: 'Audit log entry not found' });
        }

        if (log.action === 'customer_created') {
            const customerId = log.entityId;
            if (!customerId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const loansCount = await prisma.loan.count({ where: { customerId, orgId: req.orgId } });
            const vehiclesCount = await prisma.vehicle.count({ where: { customerId, orgId: req.orgId } });

            if (loansCount > 0 || vehiclesCount > 0) {
                return res.status(400).json({
                    error: 'Cannot revert customer creation: Customer has active loans or vehicles. Delete those first.'
                });
            }

            await prisma.customer.delete({ where: { id: customerId } });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'customer_creation_reverted',
                entityType: 'customer',
                entityId: customerId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Customer addition successfully reverted.' });
        }

        if (log.action === 'customer_updated') {
            const customerId = log.entityId;
            if (!customerId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const details = log.details || {};
            if (!details.previous) {
                return res.status(400).json({ error: 'Previous state not available in this audit log. Cannot revert.' });
            }

            await prisma.customer.update({
                where: { id: customerId },
                data: details.previous
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'customer_update_reverted',
                entityType: 'customer',
                entityId: customerId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Customer update successfully reverted.' });
        }

        if (log.action === 'loan_created') {
            const loanId = log.entityId;
            if (!loanId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const paymentsCount = await prisma.payment.count({ where: { loanId, orgId: req.orgId } });
            if (paymentsCount > 0) {
                return res.status(400).json({
                    error: 'Cannot revert loan creation: Loan has recorded payments. Revert payments first.'
                });
            }

            await prisma.$transaction(async (tx) => {
                const tasks = await tx.callTask.findMany({ where: { loanId, orgId: req.orgId } });
                const taskIds = tasks.map(t => t.id);
                await tx.callLog.deleteMany({ where: { callTaskId: { in: taskIds } } });
                await tx.callTask.deleteMany({ where: { loanId, orgId: req.orgId } });

                await tx.loanDue.deleteMany({ where: { loanId, orgId: req.orgId } });
                await tx.guarantor.deleteMany({ where: { loanId, orgId: req.orgId } });
                await tx.loan.delete({ where: { id: loanId } });
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'loan_creation_reverted',
                entityType: 'loan',
                entityId: loanId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Loan creation successfully reverted.' });
        }

        if (log.action === 'loan_updated') {
            const loanId = log.entityId;
            if (!loanId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const details = log.details || {};
            if (!details.previous) {
                return res.status(400).json({ error: 'Previous state not available in this audit log. Cannot revert.' });
            }

            const paymentsCount = await prisma.payment.count({ where: { loanId, orgId: req.orgId } });
            const hasCoreFieldsChanged = 
                details.previous.principalAmount !== undefined || 
                details.previous.tenureMonths !== undefined || 
                details.previous.monthlyInterestRate !== undefined || 
                details.previous.startDate !== undefined;

            if (paymentsCount > 0 && hasCoreFieldsChanged) {
                return res.status(400).json({
                    error: 'Cannot revert loan update because payments have already been recorded against this loan. Revert payments first.'
                });
            }

            await prisma.$transaction(async (tx) => {
                const updatedLoan = await tx.loan.update({
                    where: { id: loanId },
                    data: details.previous
                });

                if (hasCoreFieldsChanged) {
                    const loanService = require('../services/loan.service');
                    const { dues } = loanService.generateSchedule(
                        updatedLoan.principalAmount,
                        updatedLoan.tenureMonths,
                        updatedLoan.monthlyInterestRate,
                        updatedLoan.startDate
                    );

                    await tx.loanDue.deleteMany({ where: { loanId } });

                    const { v4: uuidv4 } = require('uuid');
                    const loanDuesData = dues.map((due) => ({
                        id: uuidv4(),
                        orgId: req.orgId,
                        loanId,
                        dueSequence: due.dueSequence,
                        dueDate: due.dueDate,
                        principalDue: due.principalDue,
                        interestDue: due.interestDue,
                        penaltyDue: due.penaltyDue,
                        amountPaid: due.amountPaid,
                        totalDue: due.totalDue,
                        status: due.status,
                    }));

                    await tx.loanDue.createMany({ data: loanDuesData });

                    const firstDueDate = dues[0]?.dueDate;
                    if (firstDueDate) {
                        await tx.callTask.updateMany({
                            where: { loanId },
                            data: { nextCallDate: firstDueDate }
                        });
                    }
                }
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'loan_update_reverted',
                entityType: 'loan',
                entityId: loanId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Loan update successfully reverted.' });
        }

        if (log.action === 'payment_recorded') {
            const paymentId = log.entityId;
            if (!paymentId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const payment = await prisma.payment.findFirst({
                where: { id: paymentId, orgId: req.orgId }
            });
            if (!payment) return res.status(404).json({ error: 'Payment record not found' });

            const allocationDetails = payment.allocationDetails || [];
            const loanId = payment.loanId;

            await prisma.$transaction(async (tx) => {
                for (const alloc of allocationDetails) {
                    const due = await tx.loanDue.findUnique({ where: { id: alloc.loanDueId } });
                    if (due) {
                        const newAmountPaid = Math.max(0, Number(due.amountPaid) - Number(alloc.total));
                        const isOverdue = new Date(due.dueDate) < new Date();
                        const newStatus = newAmountPaid <= 0 ? (isOverdue ? 'pending' : 'upcoming') : 'pending';

                        await tx.loanDue.update({
                            where: { id: due.id },
                            data: {
                                amountPaid: newAmountPaid,
                                status: newStatus
                            }
                        });
                    }
                }

                const totalPrincipal = allocationDetails.reduce((sum, a) => sum + (Number(a.principal) || 0), 0);
                const loan = await tx.loan.findUnique({ where: { id: loanId } });
                if (loan) {
                    await tx.loan.update({
                        where: { id: loanId },
                        data: {
                            outstandingPrincipal: Number(loan.outstandingPrincipal) + totalPrincipal,
                            status: 'active'
                        }
                    });
                }

                await tx.receipt.deleteMany({ where: { paymentId, orgId: req.orgId } });
                await tx.payment.delete({ where: { id: paymentId } });
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'payment_reverted',
                entityType: 'payment',
                entityId: paymentId,
                details: { revertedLogId: log.id, loanId, amount: payment.amount }
            });

            return res.json({ success: true, message: 'Payment successfully reverted.' });
        }

        if (log.action === 'payment_updated') {
            const paymentId = log.entityId;
            if (!paymentId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const details = log.details || {};
            if (!details.previous) {
                return res.status(400).json({ error: 'Previous state not available in this audit log. Cannot revert.' });
            }

            await prisma.payment.update({
                where: { id: paymentId },
                data: details.previous
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'payment_update_reverted',
                entityType: 'payment',
                entityId: paymentId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Payment update successfully reverted.' });
        }

        if (log.action === 'call_logged') {
            const callLogId = log.entityId;
            if (!callLogId) return res.status(400).json({ error: 'Invalid entity ID in audit log' });

            const callLog = await prisma.callLog.findFirst({
                where: { id: callLogId }
            });
            if (!callLog) {
                return res.status(404).json({ error: 'Call log record not found' });
            }

            const callTaskId = callLog.callTaskId;

            await prisma.$transaction(async (tx) => {
                await tx.callLog.delete({ where: { id: callLogId } });

                const previousLogs = await tx.callLog.findMany({
                    where: { callTaskId },
                    orderBy: { callDate: 'desc' },
                    take: 1
                });

                if (previousLogs.length > 0) {
                    const prev = previousLogs[0];
                    await tx.callTask.update({
                        where: { id: callTaskId },
                        data: {
                            lastCallDate: prev.callDate,
                            nextCallDate: prev.nextFollowupDate || prev.callDate
                        }
                    });
                } else {
                    const task = await tx.callTask.findUnique({
                        where: { id: callTaskId },
                        include: { loan: true }
                    });
                    if (task && task.loan) {
                        const { addMonths } = require('../utils/dateUtils');
                        const firstDueDate = addMonths(new Date(task.loan.startDate), 1);
                        await tx.callTask.update({
                            where: { id: callTaskId },
                            data: {
                                lastCallDate: null,
                                nextCallDate: firstDueDate
                            }
                        });
                    }
                }
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'call_log_reverted',
                entityType: 'call_log',
                entityId: callLogId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Call log successfully reverted.' });
        }

        if (log.action === 'org_settings_updated') {
            const details = log.details || {};
            if (!details.previous) {
                return res.status(400).json({ error: 'Previous state not available in this audit log. Cannot revert.' });
            }

            await prisma.organization.update({
                where: { id: req.orgId },
                data: details.previous
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'org_settings_reverted',
                entityType: 'organization',
                entityId: req.orgId,
                details: { revertedLogId: log.id }
            });

            return res.json({ success: true, message: 'Organization settings successfully reverted.' });
        }

        return res.status(400).json({ error: `Action '${log.action}' cannot be reverted.` });
    } catch (err) {
        next(err);
    }
});

router.get('/audit-logs/entity/:entityType/:entityId', requireRole('admin'), async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;

        if (entityType === 'customer') {
            const customer = await prisma.customer.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!customer) return res.status(404).json({ error: 'Customer not found' });
            customer.aadharNumber = decrypt(customer.aadharNumber);
            return res.json(customer);
        }

        if (entityType === 'loan') {
            const loan = await prisma.loan.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!loan) return res.status(404).json({ error: 'Loan not found' });
            return res.json(loan);
        }

        if (entityType === 'payment') {
            const payment = await prisma.payment.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!payment) return res.status(404).json({ error: 'Payment not found' });
            return res.json(payment);
        }

        if (entityType === 'call_log') {
            const callLog = await prisma.callLog.findFirst({
                where: { id: entityId }
            });
            if (!callLog) return res.status(404).json({ error: 'Call log not found' });
            return res.json(callLog);
        }

        if (entityType === 'organization') {
            const org = await prisma.organization.findFirst({
                where: { id: req.orgId }
            });
            if (!org) return res.status(404).json({ error: 'Organization not found' });
            return res.json(org);
        }

        return res.status(400).json({ error: `Entity type '${entityType}' is not supported.` });
    } catch (err) {
        next(err);
    }
});

router.put('/audit-logs/entity/:entityType/:entityId', requireRole('admin'), async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;

        if (entityType === 'customer') {
            const { name, phone, altPhone, address, aadharNumber, photoUrl, optOutWhatsapp } = req.body;

            const existing = await prisma.customer.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!existing) return res.status(404).json({ error: 'Customer not found' });

            const encryptedAadhar = aadharNumber !== undefined ? encrypt(aadharNumber) : undefined;

            const updated = await prisma.customer.update({
                where: { id: entityId },
                data: { name, phone, altPhone, address, aadharNumber: encryptedAadhar, photoUrl, optOutWhatsapp }
            });

            const { logAudit } = require('../services/audit.service');
            const maskAadhar = (val) => val ? 'XXXX-XXXX-' + val.toString().replace(/[\s-]/g, '').slice(-4) : val;

            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'customer_updated',
                entityType: 'customer',
                entityId: entityId,
                details: {
                    previous: {
                        name: existing.name,
                        phone: existing.phone,
                        altPhone: existing.altPhone,
                        address: existing.address,
                        aadharNumber: maskAadhar(decrypt(existing.aadharNumber)),
                        photoUrl: existing.photoUrl,
                        optOutWhatsapp: existing.optOutWhatsapp
                    },
                    updated: { 
                        name, 
                        phone, 
                        altPhone, 
                        address, 
                        aadharNumber: maskAadhar(aadharNumber), 
                        photoUrl, 
                        optOutWhatsapp 
                    },
                    source: 'admin_edit_history'
                }
            });

            return res.json({
                ...updated,
                aadharNumber: decrypt(updated.aadharNumber)
            });
        }

        if (entityType === 'loan') {
            const { assignedStaffId, status, nextDueDate, principalAmount, tenureMonths, monthlyInterestRate, startDate } = req.body;

            const existing = await prisma.loan.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!existing) return res.status(404).json({ error: 'Loan not found' });

            const hasCoreFieldsChanged = 
                (principalAmount !== undefined && Number(principalAmount) !== Number(existing.principalAmount)) || 
                (tenureMonths !== undefined && Number(tenureMonths) !== Number(existing.tenureMonths)) || 
                (monthlyInterestRate !== undefined && Number(monthlyInterestRate) !== Number(existing.monthlyInterestRate)) || 
                (startDate !== undefined && new Date(startDate).getTime() !== new Date(existing.startDate).getTime());

            if (hasCoreFieldsChanged) {
                const paymentsCount = await prisma.payment.count({ where: { loanId: entityId, orgId: req.orgId } });
                if (paymentsCount > 0) {
                    return res.status(400).json({
                        error: 'Core financial fields (principal, tenure, interest, start date) cannot be edited because payments are already recorded against this loan. Revert payments first.'
                    });
                }
            }

            const data = {};
            if (assignedStaffId !== undefined) data.assignedStaffId = assignedStaffId;
            if (status !== undefined) data.status = status;
            if (nextDueDate !== undefined) data.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
            if (principalAmount !== undefined) data.principalAmount = Number(principalAmount);
            if (tenureMonths !== undefined) data.tenureMonths = Number(tenureMonths);
            if (monthlyInterestRate !== undefined) data.monthlyInterestRate = Number(monthlyInterestRate);
            if (startDate !== undefined) data.startDate = new Date(startDate);

            const updated = await prisma.$transaction(async (tx) => {
                const updatedLoan = await tx.loan.update({
                    where: { id: entityId },
                    data
                });

                if (hasCoreFieldsChanged) {
                    const loanService = require('../services/loan.service');
                    const { monthlyPrincipal, monthlyInterest, dues } = loanService.generateSchedule(
                        updatedLoan.principalAmount,
                        updatedLoan.tenureMonths,
                        updatedLoan.monthlyInterestRate,
                        updatedLoan.startDate
                    );

                    const P = Number(updatedLoan.principalAmount);
                    const documentFee = P * 0.05;
                    const disbursedAmount = P - documentFee;

                    const finalLoan = await tx.loan.update({
                        where: { id: entityId },
                        data: {
                            monthlyPrincipalAmount: monthlyPrincipal,
                            monthlyInterestAmount: monthlyInterest,
                            monthlyDueAmount: monthlyPrincipal + monthlyInterest,
                            outstandingPrincipal: P,
                            documentFee,
                            disbursedAmount
                        }
                    });

                    await tx.loanDue.deleteMany({ where: { loanId: entityId } });

                    const { v4: uuidv4 } = require('uuid');
                    const loanDuesData = dues.map((due) => ({
                        id: uuidv4(),
                        orgId: req.orgId,
                        loanId: entityId,
                        dueSequence: due.dueSequence,
                        dueDate: due.dueDate,
                        principalDue: due.principalDue,
                        interestDue: due.interestDue,
                        penaltyDue: due.penaltyDue,
                        amountPaid: due.amountPaid,
                        totalDue: due.totalDue,
                        status: due.status,
                    }));

                    await tx.loanDue.createMany({ data: loanDuesData });

                    const firstDueDate = dues[0]?.dueDate;
                    if (firstDueDate) {
                        await tx.callTask.updateMany({
                            where: { loanId: entityId },
                            data: { nextCallDate: firstDueDate }
                        });
                    }

                    return finalLoan;
                }

                return updatedLoan;
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'loan_updated',
                entityType: 'loan',
                entityId: entityId,
                details: {
                    previous: {
                        assignedStaffId: existing.assignedStaffId,
                        status: existing.status,
                        nextDueDate: existing.nextDueDate,
                        principalAmount: existing.principalAmount,
                        tenureMonths: existing.tenureMonths,
                        monthlyInterestRate: existing.monthlyInterestRate,
                        startDate: existing.startDate
                    },
                    updated: {
                        assignedStaffId: updated.assignedStaffId,
                        status: updated.status,
                        nextDueDate: updated.nextDueDate,
                        principalAmount: updated.principalAmount,
                        tenureMonths: updated.tenureMonths,
                        monthlyInterestRate: updated.monthlyInterestRate,
                        startDate: updated.startDate
                    },
                    source: 'admin_edit_history'
                }
            });

            return res.json(updated);
        }

        if (entityType === 'payment') {
            const { paymentMethod, referenceNumber, paymentDate, amount } = req.body;

            const existing = await prisma.payment.findFirst({
                where: { id: entityId, orgId: req.orgId }
            });
            if (!existing) return res.status(404).json({ error: 'Payment not found' });

            if (amount !== undefined && Number(amount) !== Number(existing.amount)) {
                return res.status(400).json({
                    error: 'Directly editing payment amount is not allowed. Please revert the payment and record it again.'
                });
            }

            const data = {};
            if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
            if (referenceNumber !== undefined) data.referenceNumber = referenceNumber;
            if (paymentDate !== undefined) data.paymentDate = new Date(paymentDate);

            const updated = await prisma.payment.update({
                where: { id: entityId },
                data
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'payment_updated',
                entityType: 'payment',
                entityId: entityId,
                details: {
                    previous: {
                        paymentMethod: existing.paymentMethod,
                        referenceNumber: existing.referenceNumber,
                        paymentDate: existing.paymentDate
                    },
                    updated: {
                        paymentMethod: updated.paymentMethod,
                        referenceNumber: updated.referenceNumber,
                        paymentDate: updated.paymentDate
                    },
                    source: 'admin_edit_history'
                }
            });

            return res.json(updated);
        }

        if (entityType === 'call_log') {
            const { outcome, notes, promisedPaymentAmount, promisedPaymentDate, nextFollowupDate } = req.body;

            const existing = await prisma.callLog.findFirst({
                where: { id: entityId }
            });
            if (!existing) return res.status(404).json({ error: 'Call log not found' });

            const data = {};
            if (outcome !== undefined) data.outcome = outcome;
            if (notes !== undefined) data.notes = notes;
            if (promisedPaymentAmount !== undefined) data.promisedPaymentAmount = promisedPaymentAmount ? Number(promisedPaymentAmount) : null;
            if (promisedPaymentDate !== undefined) data.promisedPaymentDate = promisedPaymentDate ? new Date(promisedPaymentDate) : null;
            if (nextFollowupDate !== undefined) data.nextFollowupDate = nextFollowupDate ? new Date(nextFollowupDate) : null;

            const updated = await prisma.$transaction(async (tx) => {
                const updatedLog = await tx.callLog.update({
                    where: { id: entityId },
                    data
                });

                if (nextFollowupDate !== undefined) {
                    await tx.callTask.update({
                        where: { id: updatedLog.callTaskId },
                        data: {
                            nextCallDate: nextFollowupDate ? new Date(nextFollowupDate) : new Date()
                        }
                    });
                }

                return updatedLog;
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'call_log_updated',
                entityType: 'call_log',
                entityId: entityId,
                details: {
                    previous: {
                        outcome: existing.outcome,
                        notes: existing.notes,
                        promisedPaymentAmount: existing.promisedPaymentAmount,
                        promisedPaymentDate: existing.promisedPaymentDate,
                        nextFollowupDate: existing.nextFollowupDate
                    },
                    updated: {
                        outcome: updated.outcome,
                        notes: updated.notes,
                        promisedPaymentAmount: updated.promisedPaymentAmount,
                        promisedPaymentDate: updated.promisedPaymentDate,
                        nextFollowupDate: updated.nextFollowupDate
                    },
                    source: 'admin_edit_history'
                }
            });

            return res.json(updated);
        }

        if (entityType === 'organization') {
            const { name, phone, address } = req.body;

            const existing = await prisma.organization.findFirst({
                where: { id: req.orgId }
            });
            if (!existing) return res.status(404).json({ error: 'Organization not found' });

            const updated = await prisma.organization.update({
                where: { id: req.orgId },
                data: { name, phone, address }
            });

            const { logAudit } = require('../services/audit.service');
            await logAudit({
                orgId: req.orgId,
                userId: req.user.id,
                action: 'org_settings_updated',
                entityType: 'organization',
                entityId: req.orgId,
                details: {
                    previous: { name: existing.name, phone: existing.phone, address: existing.address },
                    updated: { name, phone, address },
                    source: 'admin_edit_history'
                }
            });

            return res.json(updated);
        }

        return res.status(400).json({ error: `Entity type '${entityType}' is not supported for inline edits.` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
