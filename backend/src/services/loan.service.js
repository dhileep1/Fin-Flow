const prisma = require('../config/database');
const { roundHalfUp } = require('../utils/rounding');
const { addMonths, formatDate } = require('../utils/dateUtils');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate the loan due schedule for a given loan.
 * Implements the exact algorithm from the PRD:
 *   - monthly_principal = round(P / N, 2)
 *   - monthly_interest = round(P * r, 2)
 *   - Final installment absorbs rounding remainder
 */
function generateSchedule(principalAmount, tenureMonths, monthlyInterestRate, startDate) {
    const P = Number(principalAmount);
    const N = tenureMonths;
    const r = Number(monthlyInterestRate);

    const monthlyPrincipal = roundHalfUp(P / N);
    const monthlyInterest = roundHalfUp(P * r);
    const dues = [];

    for (let i = 1; i <= N; i++) {
        let principalDue;
        if (i < N) {
            principalDue = monthlyPrincipal;
        } else {
            // Final installment: absorb rounding remainder
            principalDue = roundHalfUp(P - monthlyPrincipal * (N - 1));
        }
        const interestDue = monthlyInterest;
        const totalDue = roundHalfUp(principalDue + interestDue);
        const dueDate = addMonths(new Date(startDate), i);

        dues.push({
            dueSequence: i,
            dueDate,
            principalDue,
            interestDue,
            penaltyDue: 0,
            amountPaid: 0,
            totalDue,
            status: 'upcoming',
        });
    }

    return { monthlyPrincipal, monthlyInterest, dues };
}

/**
 * Create a new loan with full schedule generation.
 */
async function createLoan({ orgId, customerId, vehicleId, assignedStaffId, principalAmount, tenureMonths, monthlyInterestRate, startDate, userId }) {
    const P = Number(principalAmount);
    const r = Number(monthlyInterestRate);
    const N = tenureMonths;

    // Compute fees
    const documentFee = roundHalfUp(P * 0.05);
    const disbursedAmount = roundHalfUp(P - documentFee);

    // Generate schedule
    const { monthlyPrincipal, monthlyInterest, dues } = generateSchedule(P, N, r, startDate);
    const monthlyDueAmount = roundHalfUp(monthlyPrincipal + monthlyInterest);

    // First due date
    const firstDueDate = addMonths(new Date(startDate), 1);

    const loanId = uuidv4();

    const result = await prisma.$transaction(async (tx) => {
        // Create loan record
        const loan = await tx.loan.create({
            data: {
                id: loanId,
                orgId,
                customerId,
                vehicleId,
                assignedStaffId: assignedStaffId || userId,
                principalAmount: P,
                tenureMonths: N,
                monthlyInterestRate: r,
                monthlyInterestAmount: monthlyInterest,
                monthlyPrincipalAmount: monthlyPrincipal,
                monthlyDueAmount,
                startDate: new Date(startDate),
                nextDueDate: firstDueDate,
                outstandingPrincipal: P,
                accruedPenalty: 0,
                documentFee,
                disbursedAmount,
                status: 'active',
            },
        });

        // Create loan dues
        const loanDuesData = dues.map((due) => ({
            id: uuidv4(),
            orgId,
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

        // Create call task for this loan
        await tx.callTask.create({
            data: {
                id: uuidv4(),
                orgId,
                loanId,
                assignedStaffId: assignedStaffId || userId,
                nextCallDate: firstDueDate,
            },
        });

        return loan;
    });

    // Audit log
    await logAudit({
        orgId,
        userId,
        action: 'loan_created',
        entityType: 'loan',
        entityId: loanId,
        details: { principalAmount: P, tenureMonths: N, documentFee, disbursedAmount },
    });

    // Fetch the full loan with dues
    const fullLoan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: {
            loanDues: { orderBy: { dueSequence: 'asc' } },
            customer: true,
            vehicle: true,
            guarantors: true,
        },
    });

    return fullLoan;
}

/**
 * Get a loan by ID with related data.
 */
async function getLoanById(orgId, loanId) {
    return prisma.loan.findFirst({
        where: { id: loanId, orgId },
        include: {
            loanDues: { orderBy: { dueSequence: 'asc' } },
            customer: true,
            vehicle: true,
            guarantors: true,
            payments: {
                include: { receipts: true },
                orderBy: { paymentDate: 'desc' },
            },
            callTasks: {
                include: {
                    callLogs: { orderBy: { callDate: 'desc' } },
                },
            },
        },
    });
}

/**
 * List loans for an org with optional filters.
 */
async function listLoans(orgId, { status, customerId, assignedStaffId, page = 1, limit = 25 } = {}) {
    const where = { orgId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [loans, total] = await Promise.all([
        prisma.loan.findMany({
            where,
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
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.loan.count({ where }),
    ]);

    // Also need paid count and overdue count per loan
    const loanIds = loans.map(l => l.id);
    
    // Fetch all dues for these loans to build a status summary and calculate total outstanding
    const allDues = await prisma.loanDue.findMany({
        where: { loanId: { in: loanIds } },
        orderBy: [{ loanId: 'asc' }, { dueSequence: 'asc' }],
        select: { 
            loanId: true, 
            status: true, 
            dueDate: true, 
            penaltyDue: true, 
            amountPaid: true, 
            totalDue: true,
            principalDue: true,
            interestDue: true
        }
    });

    const duesByLoan = allDues.reduce((acc, d) => {
        if (!acc[d.loanId]) acc[d.loanId] = [];
        acc[d.loanId].push(d);
        return acc;
    }, {});

    const enriched = loans.map(l => {
        const loanDues = duesByLoan[l.id] || [];
        const earliestUnpaid = loanDues.find(d => d.status !== 'paid');
        
        let daysOverdue = 0;
        if (earliestUnpaid) {
            const dueDate = new Date(earliestUnpaid.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate < today) {
                daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            }
        }

        let totalOutstanding = 0;
        let paidDues = 0;
        const duesSummary = loanDues.map(d => {
            const dDate = new Date(d.dueDate);
            dDate.setHours(0, 0, 0, 0);
            const isPastDue = dDate < today;
            const isFullyPaid = d.status === 'paid';
            const isPartiallyPaid = Number(d.amountPaid) > 0 && !isFullyPaid;
            const hasPenalty = Number(d.penaltyDue) > 0;
            
            if (isFullyPaid) paidDues++;
            
            const remaining = Number(d.totalDue) - Number(d.amountPaid);
            totalOutstanding += remaining;

            // Simplified logic for summary status
            if ((isFullyPaid || isPartiallyPaid) && !isPastDue) return isFullyPaid ? 'prepaid-full' : 'prepaid-partial';
            if (isFullyPaid) return hasPenalty ? 'paid-late' : 'paid-on-time';
            if (isPartiallyPaid) return 'partial';
            if (d.status === 'overdue' || (d.status === 'pending' && isPastDue)) return 'overdue';
            return 'upcoming';
        });

        // Explicitly calculate totalOverdue
        const totalOverdue = loanDues.reduce((sum, d) => {
            const dDate = new Date(d.dueDate);
            dDate.setHours(0, 0, 0, 0);
            if (dDate < today && d.status !== 'paid') {
                return sum + (Number(d.totalDue) - Number(d.amountPaid));
            }
            return sum;
        }, 0);

        return { 
            ...l, 
            daysOverdue,
            paidDues,
            totalDues: loanDues.length,
            overdueCount: loanDues.filter(d => (d.status === 'overdue' || (d.status === 'pending' && new Date(d.dueDate) < today))).length,
            totalOutstanding,
            totalOverdue,
            duesSummary
        };
    });

    return { loans: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { generateSchedule, createLoan, getLoanById, listLoans };
