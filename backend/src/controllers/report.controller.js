const prisma = require('../config/database');

async function getCollectionsReport(req, res, next) {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: 'from and to date params are required (YYYY-MM-DD)' });
        }

        const payments = await prisma.payment.findMany({
            where: {
                orgId: req.orgId,
                paymentDate: {
                    gte: new Date(from),
                    lte: new Date(to + 'T23:59:59Z'),
                },
            },
            include: {
                loan: {
                    include: {
                        customer: { select: { name: true, phone: true } },
                    },
                },
                creator: { select: { name: true } },
            },
            orderBy: { paymentDate: 'desc' },
        });

        const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const byMethod = {};
        payments.forEach((p) => {
            const method = p.paymentMethod || 'unknown';
            byMethod[method] = (byMethod[method] || 0) + Number(p.amount);
        });

        res.json({
            from,
            to,
            totalCollected,
            paymentCount: payments.length,
            byMethod,
            payments,
        });
    } catch (err) {
        next(err);
    }
}

async function getDashboardStats(req, res, next) {
    try {
        const { timeframe = 'daily' } = req.query;

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let startDate = today;
        if (timeframe === 'weekly') {
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
        } else if (timeframe === 'monthly') {
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
        }

        const [
            activeLoans,
            totalOutstanding,
            periodCollections,
            criticalDues,
            totalCustomers,
            periodDisbursements,
        ] = await Promise.all([
            prisma.loan.count({ where: { orgId: req.orgId, status: 'active' } }),
            prisma.loan.aggregate({ where: { orgId: req.orgId, status: 'active' }, _sum: { outstandingPrincipal: true } }),
            prisma.payment.aggregate({
                where: { orgId: req.orgId, paymentDate: { gte: startDate, lt: tomorrow } },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.loanDue.count({
                where: { orgId: req.orgId, status: { not: 'paid' }, dueDate: { lt: today } },
            }),
            prisma.customer.count({ where: { orgId: req.orgId } }),
            prisma.loan.aggregate({
                where: { orgId: req.orgId, createdAt: { gte: startDate, lt: tomorrow } },
                _sum: { principalAmount: true },
            }),
        ]);

        // Team performance aggregator adjusted to timeframe
        const teamPerformance = await prisma.user.findMany({
            where: { orgId: req.orgId, status: 'active' },
            select: {
                id: true,
                name: true,
                payments: {
                    where: { paymentDate: { gte: startDate, lt: tomorrow } },
                    select: { amount: true }
                },
                assignedLoans: {
                    where: { createdAt: { gte: startDate, lt: tomorrow } },
                    select: { principalAmount: true }
                }
            }
        });

        const team = teamPerformance.map(u => {
            const collectAmt = u.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const disburseAmt = u.assignedLoans.reduce((sum, l) => sum + Number(l.principalAmount), 0);
            
            // Period targets based on timeframe
            const baseDailyCollTarget = 500000;
            const baseDailyDisbTarget = 2000000;
            const multiplier = timeframe === 'weekly' ? 7 : timeframe === 'monthly' ? 30 : 1;
            
            const collTarget = baseDailyCollTarget * multiplier;
            const disbTarget = baseDailyDisbTarget * multiplier;

            return {
                id: u.id,
                name: u.name,
                collectAmt,
                disburseAmt,
                collectPct: Math.min(Math.round((collectAmt / collTarget) * 100), 100),
                disbursePct: Math.min(Math.round((disburseAmt / disbTarget) * 100), 100),
            };
        });

        const [
            recentCollections,
            recentLoans,
            priorityActionsData,
        ] = await Promise.all([
            prisma.payment.findMany({
                where: { 
                    orgId: req.orgId,
                    paymentDate: { gte: startDate, lt: tomorrow }
                },
                take: 15,
                orderBy: { paymentDate: 'desc' },
                include: {
                    loan: { include: { customer: { select: { name: true } } } },
                    creator: { select: { name: true } }
                }
            }),
            prisma.loan.findMany({
                where: { 
                    orgId: req.orgId,
                    createdAt: { gte: startDate, lt: tomorrow }
                },
                take: 15,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { name: true } },
                    vehicle: { select: { vehicleNumber: true } },
                    assignedStaff: { select: { name: true } }
                }
            }),
            prisma.loanDue.findMany({
                where: {
                    orgId: req.orgId,
                    status: { not: 'paid' },
                    dueDate: { lt: tomorrow }
                },
                take: 10,
                include: {
                    loan: { include: { customer: { select: { name: true } } } }
                },
                orderBy: { dueDate: 'asc' }
            })
        ]);

        res.json({
            activeLoans,
            totalOutstanding: Number(totalOutstanding._sum.outstandingPrincipal || 0),
            todayCollections: Number(periodCollections._sum.amount || 0), // Keeping naming for compatibility but it's period-based now
            todayPaymentCount: periodCollections._count,
            totalGiven: Number(periodDisbursements._sum.principalAmount || 0),
            criticalDues,
            totalCustomers,
            team,
            recentCollections: recentCollections.map(p => ({
                id: p.id,
                customer: p.loan.customer.name,
                amount: Number(p.amount),
                date: p.paymentDate,
                collectedBy: p.creator?.name || 'System'
            })),
            recentLoans: recentLoans.map(l => ({
                id: l.id,
                customer: l.customer.name,
                principal: Number(l.principalAmount),
                vehicle: l.vehicle.vehicleNumber,
                disbursedBy: l.assignedStaff?.name || 'Admin'
            })),
            priorityActions: priorityActionsData.map(d => {
                const diff = (today - new Date(d.dueDate));
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                return {
                    id: d.id,
                    loanId: d.loanId,
                    customerName: d.loan.customer.name,
                    amount: Number(d.totalDue) - Number(d.amountPaid),
                    dueLabel: days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`,
                    daysOverdue: days
                };
            })
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getCollectionsReport, getDashboardStats };
