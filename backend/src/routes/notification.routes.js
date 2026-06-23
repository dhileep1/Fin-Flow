const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const prisma = require('../config/database');
const { sendNotification } = require('../services/notification.service');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

/**
 * GET /api/v1/:orgId/notifications/targets
 * Get customers based on loan status and overdue filters
 */
router.get('/targets', async (req, res, next) => {
    try {
        const { loanStatus, overdue } = req.query;
        const where = { orgId: req.orgId };

        if (loanStatus || overdue === 'true') {
            where.loans = {
                some: {
                    ...(loanStatus ? { status: loanStatus } : {}),
                    ...(overdue === 'true' ? { status: { not: 'closed' }, nextDueDate: { lt: new Date() } } : {}),
                }
            };
        }

        const targets = await prisma.customer.findMany({
            where,
            include: {
                loans: {
                    include: {
                        loanDues: {
                            where: { status: { not: 'paid' } },
                            orderBy: { dueDate: 'asc' }
                        }
                    }
                }
            }
        });

        res.json({ targets });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/:orgId/notifications/bulk-send
 * Send message to multiple customers
 */
router.post('/bulk-send', async (req, res, next) => {
    try {
        const { targetIds, messageBody } = req.body;
        if (!targetIds || !Array.isArray(targetIds) || !messageBody) {
            return res.status(400).json({ error: 'Missing targetIds or messageBody' });
        }

        let successCount = 0;
        let failedCount = 0;

        for (const customerId of targetIds) {
            try {
                const result = await sendNotification({
                    orgId: req.orgId,
                    customerId,
                    type: 'manual',
                    messageBody,
                });
                if (result.success) successCount++;
                else failedCount++;
            } catch (e) {
                failedCount++;
            }
        }

        res.json({ successCount, failedCount });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
