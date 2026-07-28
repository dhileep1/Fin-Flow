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

        // Team performance aggregator using database-level _sum aggregations
        const activeUsers = await prisma.user.findMany({
            where: { orgId: req.orgId, status: 'active' },
            select: { id: true, name: true, targets: true }
        });

        const paymentAggregates = await prisma.payment.groupBy({
            by: ['createdBy'],
            where: { orgId: req.orgId, paymentDate: { gte: startDate, lt: tomorrow } },
            _sum: { amount: true }
        });

        const loanAggregates = await prisma.loan.groupBy({
            by: ['assignedStaffId'],
            where: { orgId: req.orgId, createdAt: { gte: startDate, lt: tomorrow } },
            _sum: { principalAmount: true }
        });

        const paymentMap = new Map(paymentAggregates.map(p => [p.createdBy, Number(p._sum.amount || 0)]));
        const loanMap = new Map(loanAggregates.map(l => [l.assignedStaffId, Number(l._sum.principalAmount || 0)]));

        const team = activeUsers.map(u => {
            const collectAmt = paymentMap.get(u.id) || 0;
            const disburseAmt = loanMap.get(u.id) || 0;
            
            // Period targets based on user custom targets or default targets
            const userTargets = u.targets || {};
            const baseDailyCollTarget = Number(userTargets.dailyCollTarget || 500000);
            const baseDailyDisbTarget = Number(userTargets.dailyDisbTarget || 2000000);
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
                loanNo: l.id.slice(0, 8).toUpperCase(),
                billNo: l.vehicle.vehicleNumber,
                customer: l.customer.name,
                interestGiven: Number(l.monthlyInterestAmount || 0),
                principal: Number(l.principalAmount),
                documentFee: Number(l.documentFee || 0),
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

async function getLedgerReport(req, res, next) {
    try {
        const {
            page = 1,
            limit = 20,
            tab = 'all',
            dateFilter = 'month',
            fromDate,
            toDate,
            search = ''
        } = req.query;

        const p = Math.max(1, parseInt(page, 10));
        const l = Math.max(1, parseInt(limit, 10));
        const orgId = req.orgId;

        // Build date filter condition
        const today = new Date();
        let dateClause = {};

        if (dateFilter === 'today') {
            const start = new Date(today); start.setHours(0, 0, 0, 0);
            const end = new Date(today); end.setHours(23, 59, 59, 999);
            dateClause = { gte: start, lte: end };
        } else if (dateFilter === 'week') {
            const start = new Date(today); start.setDate(today.getDate() - 7); start.setHours(0, 0, 0, 0);
            const end = new Date(today); end.setHours(23, 59, 59, 999);
            dateClause = { gte: start, lte: end };
        } else if (dateFilter === 'month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            dateClause = { gte: start, lte: end };
        } else if (dateFilter === 'year') {
            const start = new Date(today.getFullYear(), 0, 1);
            const end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            dateClause = { gte: start, lte: end };
        } else if (dateFilter === 'custom' && fromDate && toDate) {
            const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
            const end = new Date(toDate); end.setHours(23, 59, 59, 999);
            dateClause = { gte: start, lte: end };
        }

        const dateQuery = Object.keys(dateClause).length > 0 ? dateClause : undefined;

        // Fetch organization settings for starting cash
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { settings: true }
        });
        const startingCash = Number(org?.settings?.startingCash || 1000000);

        // Fetch data based on tab filter
        let payments = [];
        let loans = [];
        let expenses = [];
        let vehicleSales = [];

        if (tab === 'all' || tab === 'payments') {
            payments = await prisma.payment.findMany({
                where: {
                    orgId,
                    ...(dateQuery ? { paymentDate: dateQuery } : {})
                },
                include: {
                    loan: { select: { id: true, customer: { select: { name: true, phone: true } } } },
                    creator: { select: { name: true } },
                    receipts: { select: { receiptNumber: true } }
                },
                orderBy: { paymentDate: 'desc' }
            });
        }

        if (tab === 'all' || tab === 'loans') {
            loans = await prisma.loan.findMany({
                where: {
                    orgId,
                    ...(dateQuery ? { startDate: dateQuery } : {})
                },
                include: {
                    customer: { select: { name: true, phone: true } },
                    assignedStaff: { select: { name: true } }
                },
                orderBy: { startDate: 'desc' }
            });
        }

        if (tab === 'all' || tab === 'expenses') {
            expenses = await prisma.expense.findMany({
                where: {
                    orgId,
                    ...(dateQuery ? { expenseDate: dateQuery } : {})
                },
                include: {
                    creator: { select: { name: true } }
                },
                orderBy: { expenseDate: 'desc' }
            });
        }

        if (tab === 'all' || tab === 'vehicleSales') {
            vehicleSales = await prisma.vehicleSale.findMany({
                where: {
                    orgId,
                    ...(dateQuery ? { saleDate: dateQuery } : {})
                },
                include: {
                    vehicle: { select: { vehicleNumber: true, model: true } },
                    creator: { select: { name: true } }
                },
                orderBy: { saleDate: 'desc' }
            });
        }

        // Standardize list
        let rawList = [];

        payments.forEach(p => {
            rawList.push({
                id: `p-${p.id}`,
                date: p.paymentDate,
                type: 'Payment',
                typeClass: 'border-emerald-500 text-emerald-700 bg-emerald-50',
                title: `EMI Bill #${p.receipts?.[0]?.receiptNumber || '—'}`,
                details: `Loan Reference: #${p.loanId?.slice(0, 8).toUpperCase()}`,
                customer: p.loan?.customer?.name || '—',
                inflow: Number(p.amount),
                outflow: 0,
                creator: p.creator?.name || 'System'
            });
        });

        loans.forEach(l => {
            rawList.push({
                id: `l-doc-${l.id}`,
                date: l.startDate,
                type: 'Doc Fee',
                typeClass: 'border-blue-500 text-blue-700 bg-blue-50',
                title: `Loan Reference: #${l.id?.slice(0, 8).toUpperCase()}`,
                details: 'Processing & documentation charges',
                customer: l.customer?.name || '—',
                inflow: Number(l.documentFee),
                outflow: 0,
                creator: l.assignedStaff?.name || 'Admin'
            });
            rawList.push({
                id: `l-principal-${l.id}`,
                date: l.startDate,
                type: 'Disbursal',
                typeClass: 'border-amber-500 text-amber-700 bg-amber-50',
                title: `Loan Reference: #${l.id?.slice(0, 8).toUpperCase()}`,
                details: 'Principal disbursed amount',
                customer: l.customer?.name || '—',
                inflow: 0,
                outflow: Number(l.principalAmount),
                creator: l.assignedStaff?.name || 'Admin'
            });
        });

        expenses.forEach(e => {
            rawList.push({
                id: `e-${e.id}`,
                date: e.expenseDate,
                type: 'Expense',
                typeClass: 'border-red-500 text-red-700 bg-red-50',
                title: e.category ? e.category.toUpperCase() : 'GENERAL',
                details: e.description || 'No description provided',
                customer: '—',
                inflow: 0,
                outflow: Number(e.amount),
                creator: e.creator?.name || 'System'
            });
        });

        vehicleSales.forEach(s => {
            rawList.push({
                id: `vs-${s.id}`,
                date: s.saleDate,
                type: 'Vehicle Sale',
                typeClass: 'border-purple-500 text-purple-700 bg-purple-50',
                title: `Vehicle: ${s.vehicle?.vehicleNumber || '—'}`,
                details: `Sale Type: ${s.saleType === 'sell' ? 'Cash' : 'Financed Downpayment'}`,
                customer: s.buyerName || '—',
                inflow: Number(s.saleAmount),
                outflow: 0,
                creator: s.creator?.name || 'System'
            });
        });

        // Filter by search query if provided
        if (search.trim()) {
            const q = search.toLowerCase();
            rawList = rawList.filter(item => 
                item.title.toLowerCase().includes(q) ||
                item.details.toLowerCase().includes(q) ||
                item.customer.toLowerCase().includes(q) ||
                item.creator.toLowerCase().includes(q)
            );
        }

        // Sort descending
        rawList.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Summary stats
        let totalInflow = 0;
        let totalOutflow = 0;
        rawList.forEach(item => {
            totalInflow += item.inflow;
            totalOutflow += item.outflow;
        });

        // Pagination
        const totalItems = rawList.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / l));
        const startIndex = (p - 1) * l;
        const paginatedData = rawList.slice(startIndex, startIndex + l);

        res.json({
            data: paginatedData,
            summary: {
                totalInflow,
                totalOutflow,
                netTally: totalInflow - totalOutflow,
                openingCashInHand: startingCash,
                closingCashInHand: startingCash + totalInflow - totalOutflow,
            },
            pagination: {
                totalItems,
                totalPages,
                page: p,
                limit: l,
            }
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getCollectionsReport, getDashboardStats, getLedgerReport };
