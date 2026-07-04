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
async function listLoans(orgId, { status, customerId, assignedStaffId, page = 1, limit = 25, q, type } = {}) {
    const where = { orgId };
    if (status) {
        if (status === 'overdue') {
            where.status = 'active';
            where.loanDues = {
                some: {
                    status: { not: 'paid' },
                    dueDate: { lt: new Date() }
                }
            };
        } else {
            where.status = status;
        }
    }
    if (customerId) where.customerId = customerId;
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;

    if (q && q.trim()) {
        const queryStr = q.trim();
        if (type === 'name') {
            where.customer = { name: { contains: queryStr, mode: 'insensitive' } };
        } else if (type === 'phone') {
            where.customer = { phone: { contains: queryStr } };
        } else if (type === 'vehicle') {
            where.vehicle = {
                OR: [
                    { vehicleNumber: { contains: queryStr, mode: 'insensitive' } },
                    { model: { contains: queryStr, mode: 'insensitive' } }
                ]
            };
        }
    }

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
            orderBy: {
                customer: {
                    name: 'asc'
                }
            },
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

/**
 * Calculate foreclosure quote.
 */
async function calculateForeclosureQuote(orgId, loanId, foreclosureRate) {
    const loan = await prisma.loan.findFirst({
        where: { id: loanId, orgId },
        include: { loanDues: true }
    });
    if (!loan) throw new Error('Loan not found');

    const start = new Date(loan.startDate);
    const now = new Date();
    let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() > start.getDate()) {
        elapsedMonths += 1;
    }
    elapsedMonths = Math.max(1, elapsedMonths);
    elapsedMonths = Math.min(loan.tenureMonths, elapsedMonths);

    const P = Number(loan.principalAmount);
    const rNew = Number(foreclosureRate);
    const rOrig = Number(loan.monthlyInterestRate);

    const monthlyInterestNew = roundHalfUp(P * rNew);
    const totalInterestNew = roundHalfUp(monthlyInterestNew * elapsedMonths);

    const monthlyInterestOrig = Number(loan.monthlyInterestAmount);
    const totalInterestOrig = roundHalfUp(monthlyInterestOrig * elapsedMonths);

    // Get total penalties accrued
    const totalPenaltiesObj = await prisma.penalty.aggregate({
        where: { loanDue: { loanId } },
        _sum: { penaltyAmount: true }
    });
    const totalPenalties = Number(totalPenaltiesObj._sum.penaltyAmount || 0);

    // Get total paid so far
    const totalPaidObj = await prisma.payment.aggregate({
        where: { loanId },
        _sum: { amount: true }
    });
    const totalPaid = Number(totalPaidObj._sum.amount || 0);

    const totalLiability = roundHalfUp(P + totalInterestNew + totalPenalties);
    const foreclosureAmount = Math.max(0, roundHalfUp(totalLiability - totalPaid));

    return {
        principal: P,
        elapsedMonths,
        originalRate: rOrig,
        newRate: rNew,
        originalInterestAccrued: totalInterestOrig,
        newInterestAccrued: totalInterestNew,
        interestDifference: roundHalfUp(totalInterestNew - totalInterestOrig),
        totalPenalties,
        totalPaid,
        totalLiability,
        foreclosureAmount
    };
}

/**
 * Execute foreclosure transaction.
 */
async function executeForeclosure(orgId, loanId, { foreclosureRate, paymentMethod, referenceNumber, createdBy, paymentDate }) {
    const quote = await calculateForeclosureQuote(orgId, loanId, foreclosureRate);
    const amount = quote.foreclosureAmount;

    return prisma.$transaction(async (tx) => {
        // 1. Delete future dues
        await tx.loanDue.deleteMany({
            where: {
                loanId,
                dueSequence: { gt: quote.elapsedMonths }
            }
        });

        // 2. Adjust remaining dues
        const dues = await tx.loanDue.findMany({
            where: { loanId },
            orderBy: { dueSequence: 'asc' }
        });

        const P = Number(quote.principal);
        const monthlyPrincipal = roundHalfUp(P / quote.elapsedMonths);
        const rNew = Number(foreclosureRate);
        const monthlyInterestNew = roundHalfUp(P * rNew);

        for (const due of dues) {
            let principalDue;
            if (due.dueSequence < quote.elapsedMonths) {
                principalDue = monthlyPrincipal;
            } else {
                principalDue = roundHalfUp(P - monthlyPrincipal * (quote.elapsedMonths - 1));
            }
            const interestDue = monthlyInterestNew;
            const penaltyDue = Number(due.penaltyDue);
            const totalDue = roundHalfUp(principalDue + interestDue + penaltyDue);

            await tx.loanDue.update({
                where: { id: due.id },
                data: {
                    principalDue,
                    interestDue,
                    totalDue
                }
            });
        }

        // 3. Record foreclosure payment if amount > 0
        let paymentResult = null;
        if (amount > 0) {
            const allocationDetails = [];
            let remaining = amount;

            const updatedDues = await tx.loanDue.findMany({
                where: { loanId },
                orderBy: { dueSequence: 'asc' }
            });

            for (const due of updatedDues) {
                if (remaining <= 0) break;
                const dueRemaining = roundHalfUp(Number(due.totalDue) - Number(due.amountPaid));
                if (dueRemaining <= 0) continue;

                const allocation = {
                    loanDueId: due.id,
                    dueSequence: due.dueSequence,
                    penalty: 0,
                    interest: 0,
                    principal: 0,
                    total: 0,
                };

                if (remaining >= dueRemaining) {
                    allocation.total = dueRemaining;

                    let leftover = dueRemaining;
                    const penaltyRemaining = roundHalfUp(Number(due.penaltyDue) - Math.max(0, Number(due.amountPaid) - Number(due.principalDue) - Number(due.interestDue)));
                    const penaltyAlloc = Math.min(leftover, Math.max(0, penaltyRemaining));
                    allocation.penalty = roundHalfUp(penaltyAlloc);
                    leftover -= penaltyAlloc;

                    const interestAlloc = Math.min(leftover, Number(due.interestDue));
                    allocation.interest = roundHalfUp(interestAlloc);
                    leftover -= interestAlloc;

                    allocation.principal = roundHalfUp(leftover);

                    await tx.loanDue.update({
                        where: { id: due.id },
                        data: {
                            amountPaid: Number(due.totalDue),
                            status: 'paid'
                        }
                    });

                    remaining = roundHalfUp(remaining - dueRemaining);
                } else {
                    allocation.total = roundHalfUp(remaining);

                    let leftover = remaining;
                    const penaltyUnpaid = roundHalfUp(Math.max(0, Number(due.penaltyDue)));
                    const penaltyAlloc = Math.min(leftover, penaltyUnpaid);
                    allocation.penalty = roundHalfUp(penaltyAlloc);
                    leftover = roundHalfUp(leftover - penaltyAlloc);

                    const interestUnpaid = Number(due.interestDue);
                    const interestAlloc = Math.min(leftover, interestUnpaid);
                    allocation.interest = roundHalfUp(interestAlloc);
                    leftover = roundHalfUp(leftover - interestAlloc);

                    allocation.principal = roundHalfUp(leftover);

                    await tx.loanDue.update({
                        where: { id: due.id },
                        data: {
                            amountPaid: roundHalfUp(Number(due.amountPaid) + remaining),
                            status: 'pending'
                        }
                    });

                    remaining = 0;
                }
                allocationDetails.push(allocation);
            }

            const paymentId = uuidv4();
            const payment = await tx.payment.create({
                data: {
                    id: paymentId,
                    orgId,
                    loanId,
                    amount,
                    paymentMethod,
                    referenceNumber,
                    allocationDetails: allocationDetails,
                    createdBy,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date()
                }
            });

            const receiptNumber = `RCP-${Date.now()}-${paymentId.slice(0, 8).toUpperCase()}`;
            await tx.receipt.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    paymentId,
                    receiptNumber
                }
            });

            paymentResult = payment;
        } else {
            await tx.loanDue.updateMany({
                where: { loanId },
                data: { status: 'paid' }
            });
        }

        // 4. Close the loan
        const loan = await tx.loan.update({
            where: { id: loanId },
            data: {
                tenureMonths: quote.elapsedMonths,
                monthlyInterestRate: quote.newRate,
                monthlyInterestAmount: roundHalfUp(P * quote.newRate),
                monthlyPrincipalAmount: roundHalfUp(P / quote.elapsedMonths),
                monthlyDueAmount: roundHalfUp(roundHalfUp(P / quote.elapsedMonths) + roundHalfUp(P * quote.newRate)),
                outstandingPrincipal: 0,
                status: 'closed'
            }
        });

        // Audit log in transaction context
        await logAudit({
            orgId,
            userId: createdBy,
            action: 'loan_foreclosed',
            entityType: 'loan',
            entityId: loanId,
            details: { quote, amount }
        });

        return { loan, payment: paymentResult };
    });
}

module.exports = { generateSchedule, createLoan, getLoanById, listLoans, calculateForeclosureQuote, executeForeclosure };

