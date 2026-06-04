const prisma = require('../config/database');
const { addDays } = require('../utils/dateUtils');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Get call task queue ordered by priority:
 * next_call_date ASC → days_overdue DESC → outstanding DESC → loan_id
 */
async function getCallQueue(orgId, { assignedStaffId, dueBefore, page = 1, limit = 25 } = {}) {
    const where = { orgId };
    if (assignedStaffId) {
        where.OR = [
            { assignedStaffId },
            { assignedStaffId: null },
        ];
    }
    if (dueBefore) {
        where.nextCallDate = { lte: new Date(dueBefore) };
    }

    const now = new Date();
    const [tasks, total] = await Promise.all([
        prisma.callTask.findMany({
            where: {
                ...where,
                loan: {
                    loanDues: {
                        some: {
                            status: { not: 'paid' },
                            dueDate: { lt: now }
                        }
                    }
                }
            },
            include: {
                loan: {
                    include: {
                        customer: { select: { id: true, name: true, phone: true } },
                        vehicle: { select: { id: true, vehicleNumber: true, model: true } },
                        loanDues: {
                            where: { status: { not: 'paid' } },
                            orderBy: { dueDate: 'asc' },
                            take: 1,
                        },
                        _count: {
                            select: {
                                loanDues: true,
                            }
                        },
                    },
                },
                assignedStaff: { select: { id: true, name: true } },
                callLogs: { orderBy: { callDate: 'desc' } }
            },
            orderBy: [
                { nextCallDate: 'asc' },
            ],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.callTask.count({ 
            where: {
                ...where,
                loan: {
                    loanDues: {
                        some: {
                            status: { not: 'paid' },
                            dueDate: { lt: now }
                        }
                    }
                }
            }
        }),
    ]);

    // Need overdue count, and paid count per loan
    const loanIds = tasks.map(t => t.loanId);
    let paidCounts = [];
    let overdueCounts = [];

    if (loanIds.length > 0) {
        [paidCounts, overdueCounts] = await Promise.all([
            prisma.loanDue.groupBy({
                by: ['loanId'],
                where: { loanId: { in: loanIds }, status: 'paid' },
                _count: true,
            }),
            prisma.loanDue.groupBy({
                by: ['loanId'],
                where: { 
                    loanId: { in: loanIds }, 
                    status: { not: 'paid' },
                    dueDate: { lt: now }
                },
                _count: true,
            }),
        ]);
    }

    const paidMap = Object.fromEntries(paidCounts.map(c => [c.loanId, c._count]));
    const overdueMap = Object.fromEntries(overdueCounts.map(c => [c.loanId, c._count]));

    // Enrich with days_overdue and outstanding
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const enriched = tasks.map((task) => {
        const earliestOverdueDue = task.loan.loanDues[0];
        let daysOverdue = 0;
        if (earliestOverdueDue) {
            const dueDate = new Date(earliestOverdueDue.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
        }

        const overdueCount = overdueMap[task.loanId] || 0;
        const paidDues = paidMap[task.loanId] || 0;
        const totalDues = task.loan._count.loanDues;

        // Default follow-up date: earliest due date if never called, otherwise nextCallDate
        const followUpDate = task.lastCallDate ? task.nextCallDate : (earliestOverdueDue?.dueDate || task.nextCallDate);

        return {
            ...task,
            nextCallDate: followUpDate,
            daysOverdue,
            overdueCount,
            paidDues,
            totalDues,
            outstandingPrincipal: Number(task.loan.outstandingPrincipal),
        };
    });

    // Sort by priority: next_call_date ASC (already), then days_overdue DESC, outstanding DESC
    enriched.sort((a, b) => {
        const dateA = a.nextCallDate ? new Date(a.nextCallDate).getTime() : Infinity;
        const dateB = b.nextCallDate ? new Date(b.nextCallDate).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        if (b.outstandingPrincipal !== a.outstandingPrincipal) return b.outstandingPrincipal - a.outstandingPrincipal;
        return 0;
    });

    return { tasks: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Log a call and update call task's next follow-up date.
 * Default: call_date + 7 days if next_followup_date not provided.
 */
async function logCall({ callTaskId, userId, callDate, outcome, notes, promisedPaymentAmount, promisedPaymentDate, nextFollowupDate }) {
    const callDateObj = callDate ? new Date(callDate) : new Date();

    // Determine next call date
    const nextCallDate = nextFollowupDate
        ? new Date(nextFollowupDate)
        : addDays(callDateObj, 7); // Default: +7 days

    const result = await prisma.$transaction(async (tx) => {
        const callLog = await tx.callLog.create({
            data: {
                id: uuidv4(),
                callTaskId,
                userId,
                callDate: callDateObj,
                outcome,
                notes,
                promisedPaymentAmount: promisedPaymentAmount ? Number(promisedPaymentAmount) : null,
                promisedPaymentDate: promisedPaymentDate ? new Date(promisedPaymentDate) : null,
                nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
            },
        });

        // Update call task
        await tx.callTask.update({
            where: { id: callTaskId },
            data: {
                lastCallDate: callDateObj,
                nextCallDate,
            },
        });

        return callLog;
    });

    // Audit
    const task = await prisma.callTask.findUnique({ where: { id: callTaskId } });
    await logAudit({
        orgId: task.orgId,
        userId,
        action: 'call_logged',
        entityType: 'call_log',
        entityId: result.id,
        details: { callTaskId, outcome, nextCallDate },
    });

    return result;
}

module.exports = { getCallQueue, logCall };
