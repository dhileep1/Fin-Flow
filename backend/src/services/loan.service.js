const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const { roundHalfUp } = require('../utils/rounding');
const { addMonths, formatDate } = require('../utils/dateUtils');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');

function getDuePaidBreakdown(due, allocationOrder) {
    let currentPaid = new Prisma.Decimal(due.amountPaid || 0);
    const paid = { penalty: new Prisma.Decimal(0), interest: new Prisma.Decimal(0), principal: new Prisma.Decimal(0) };
    for (const component of allocationOrder) {
        const limitValue = new Prisma.Decimal(due[component + 'Due'] || 0);
        const allocated = Prisma.Decimal.min(currentPaid, limitValue);
        paid[component] = allocated;
        currentPaid = currentPaid.minus(allocated);
    }
    if (currentPaid.greaterThan(0) && allocationOrder.length > 0) {
        const lastComponent = allocationOrder[allocationOrder.length - 1];
        paid[lastComponent] = paid[lastComponent].plus(currentPaid);
    }
    return paid;
}

/**
 * Generate the loan due schedule for a given loan.
 * Implements the exact algorithm from the PRD:
 *   - monthly_principal = round(P / N, 2)
 *   - monthly_interest = round(P * r, 2)
 *   - Final installment absorbs rounding remainder
 */
function generateSchedule(principalAmount, tenureMonths, monthlyInterestRate, startDate) {
    const P = new Prisma.Decimal(principalAmount);
    const N = tenureMonths;
    const r = new Prisma.Decimal(monthlyInterestRate);

    const monthlyPrincipal = new Prisma.Decimal(P.div(N).toFixed(2));
    const monthlyInterest = new Prisma.Decimal(P.times(r).toFixed(2));
    const dues = [];

    for (let i = 1; i <= N; i++) {
        let principalDue;
        if (i < N) {
            principalDue = monthlyPrincipal;
        } else {
            // Final installment: absorb rounding remainder
            principalDue = P.minus(monthlyPrincipal.times(N - 1));
        }
        const interestDue = monthlyInterest;
        const totalDue = principalDue.plus(interestDue);
        const dueDate = addMonths(new Date(startDate), i);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueD = new Date(dueDate);
        dueD.setHours(0, 0, 0, 0);

        let status = 'upcoming';
        if (dueD < today) {
            status = 'overdue';
        } else if (dueD.getTime() === today.getTime()) {
            status = 'pending';
        }

        dues.push({
            dueSequence: i,
            dueDate,
            principalDue,
            interestDue,
            penaltyDue: new Prisma.Decimal(0),
            amountPaid: new Prisma.Decimal(0),
            totalDue,
            status,
        });
    }

    return { monthlyPrincipal, monthlyInterest, dues };
}

/**
 * Create a new loan with full schedule generation.
 */
async function createLoan({ orgId, customerId, vehicleId, assignedStaffId, principalAmount, tenureMonths, monthlyInterestRate, startDate, userId, disbursedAmountOverride }) {
    const P = new Prisma.Decimal(principalAmount);
    const r = new Prisma.Decimal(monthlyInterestRate);
    const N = tenureMonths;

    // Fetch organization settings for processing fee
    const org = await prisma.organization.findUnique({
        where: { id: orgId }
    });
    const settings = org?.settings || {};
    const docFeePercent = new Prisma.Decimal(settings.documentFeePercent !== undefined ? settings.documentFeePercent : 0.05);

    // Compute fees
    const documentFee = new Prisma.Decimal(P.times(docFeePercent).toFixed(2));
    const disbursedAmount = disbursedAmountOverride !== undefined ? new Prisma.Decimal(disbursedAmountOverride) : P.minus(documentFee);

    // Generate schedule
    const { monthlyPrincipal, monthlyInterest, dues } = generateSchedule(P, N, r, startDate);
    const monthlyDueAmount = monthlyPrincipal.plus(monthlyInterest);

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
                accruedPenalty: new Prisma.Decimal(0),
                documentFee,
                disbursedAmount,
                status: 'active',
            },
        });

        // Update the Vehicle customerId and status to active (for new loan or financed resale)
        await tx.vehicle.update({
            where: { id: vehicleId, orgId },
            data: { 
                customerId,
                status: 'active'
            }
        });

        // Update any associated 'in_yard' seizure status to 'sold' (for financed resale)
        await tx.vehicleSeizure.updateMany({
            where: { vehicleId, orgId, status: 'in_yard' },
            data: { status: 'sold' }
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
        details: { principalAmount: P.toNumber(), tenureMonths: N, documentFee: documentFee.toNumber(), disbursedAmount: disbursedAmount.toNumber() },
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
            vehicle: {
                include: {
                    seizures: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            },
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

    const P = new Prisma.Decimal(loan.principalAmount);
    const rNew = new Prisma.Decimal(foreclosureRate);
    const rOrig = new Prisma.Decimal(loan.monthlyInterestRate);

    const org = prisma.organization ? await prisma.organization.findUnique({
        where: { id: orgId }
    }) : null;
    const settings = org?.settings || {};
    const allocationOrder = settings.allocationOrder || ['penalty', 'interest', 'principal'];

    let outstandingPrincipal = P;
    let totalInterestNew = new Prisma.Decimal(0);
    const sortedDues = loan.loanDues.sort((a, b) => a.dueSequence - b.dueSequence);

    for (let i = 1; i <= elapsedMonths; i++) {
        const due = sortedDues.find(d => d.dueSequence === i);
        if (!due) continue;

        const interestNew_i = new Prisma.Decimal(outstandingPrincipal.times(rNew).toFixed(2));
        totalInterestNew = totalInterestNew.plus(interestNew_i);

        const paid = getDuePaidBreakdown(due, allocationOrder);
        outstandingPrincipal = Prisma.Decimal.max(0, outstandingPrincipal.minus(paid.principal));
    }

    const monthlyInterestOrig = new Prisma.Decimal(loan.monthlyInterestAmount);
    const totalInterestOrig = new Prisma.Decimal(monthlyInterestOrig.times(elapsedMonths).toFixed(2));

    // Get total penalties accrued
    const totalPenaltiesObj = await prisma.penalty.aggregate({
        where: { loanDue: { loanId } },
        _sum: { penaltyAmount: true }
    });
    const totalPenalties = new Prisma.Decimal(totalPenaltiesObj._sum.penaltyAmount || 0);

    // Get total paid so far
    const totalPaidObj = await prisma.payment.aggregate({
        where: { loanId },
        _sum: { amount: true }
    });
    const totalPaid = new Prisma.Decimal(totalPaidObj._sum.amount || 0);

    const totalLiability = P.plus(totalInterestNew).plus(totalPenalties);
    const foreclosureAmount = Prisma.Decimal.max(0, totalLiability.minus(totalPaid));

    return {
        principal: P.toNumber(),
        elapsedMonths,
        originalRate: rOrig.toNumber(),
        newRate: rNew.toNumber(),
        originalInterestAccrued: totalInterestOrig.toNumber(),
        newInterestAccrued: totalInterestNew.toNumber(),
        interestDifference: totalInterestNew.minus(totalInterestOrig).toNumber(),
        totalPenalties: totalPenalties.toNumber(),
        totalPaid: totalPaid.toNumber(),
        totalLiability: totalLiability.toNumber(),
        foreclosureAmount: foreclosureAmount.toNumber()
    };
}

/**
 * Execute foreclosure transaction.
 */
async function executeForeclosure(orgId, loanId, { foreclosureRate, paymentMethod, referenceNumber, createdBy, paymentDate }) {
    if (paymentDate) {
        const payDate = new Date(paymentDate);
        const now = new Date();
        if (payDate.getTime() > now.getTime() + 5 * 60 * 1000) {
            throw new Error('Payment date cannot be in the future');
        }
        const maxPastAllowed = 3 * 24 * 60 * 60 * 1000;
        if (now.getTime() - payDate.getTime() > maxPastAllowed) {
            throw new Error('Payment date cannot be backdated by more than 3 days');
        }
    }

    // BIZ-8: Quote is now calculated inside the transaction to prevent stale data
    return prisma.$transaction(async (tx) => {
        const quote = await calculateForeclosureQuote(orgId, loanId, foreclosureRate);
        const amount = new Prisma.Decimal(quote.foreclosureAmount);
        // BIZ-6: Pessimistic lock on organization row to prevent race conditions on receipt sequences
        let org;
        if (tx.$queryRawUnsafe) {
            const orgs = await tx.$queryRawUnsafe(
                'SELECT * FROM organizations WHERE id = $1::uuid FOR UPDATE',
                orgId
            );
            org = orgs[0];
        } else if (tx.organization) {
            org = await tx.organization.findUnique({
                where: { id: orgId }
            });
        }
        const settings = org?.settings || {};
        const allocationOrder = settings.allocationOrder || ['penalty', 'interest', 'principal'];

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

        const P = new Prisma.Decimal(quote.principal);
        const monthlyPrincipal = new Prisma.Decimal(P.div(quote.elapsedMonths).toFixed(2));
        const rNew = new Prisma.Decimal(foreclosureRate);

        // Re-allocate existing totalPaid across the adjusted dues sequence
        let remainingPaid = new Prisma.Decimal(quote.totalPaid);
        let outstandingPrincipal = P;
        for (const due of dues) {
            let principalDue;
            if (due.dueSequence < quote.elapsedMonths) {
                principalDue = monthlyPrincipal;
            } else {
                principalDue = P.minus(monthlyPrincipal.times(quote.elapsedMonths - 1));
            }
            const interestDue = new Prisma.Decimal(outstandingPrincipal.times(rNew).toFixed(2));
            const penaltyDue = new Prisma.Decimal(due.penaltyDue);
            const totalDue = principalDue.plus(interestDue).plus(penaltyDue);

            const allocated = Prisma.Decimal.min(remainingPaid, totalDue);
            const amountPaid = allocated;
            
            // BIZ-11: Set correct status (paid, overdue, or pending/upcoming)
            const isPaid = amountPaid.greaterThanOrEqualTo(totalDue.minus(0.01));
            const isOverdue = new Date(due.dueDate) < new Date();
            const status = isPaid ? 'paid' : (isOverdue ? 'overdue' : (amountPaid.greaterThan(0) ? 'pending' : 'upcoming'));

            await tx.loanDue.update({
                where: { id: due.id },
                data: {
                    principalDue,
                    interestDue,
                    totalDue,
                    amountPaid,
                    status
                }
            });

            // Calculate paid components for this due to update declining balance
            const paid = getDuePaidBreakdown({
                penaltyDue,
                interestDue,
                principalDue,
                amountPaid
            }, allocationOrder);
            outstandingPrincipal = Prisma.Decimal.max(0, outstandingPrincipal.minus(paid.principal));

            remainingPaid = remainingPaid.minus(allocated);
        }

        // 3. Record foreclosure payment if amount > 0
        let paymentResult = null;
        if (amount.greaterThan(0)) {
            const allocationDetails = [];
            let remaining = amount;

            const updatedDues = await tx.loanDue.findMany({
                where: { loanId },
                orderBy: { dueSequence: 'asc' }
            });

            for (const due of updatedDues) {
                if (remaining.lessThanOrEqualTo(0)) break;
                const dueTotal = new Prisma.Decimal(due.totalDue);
                const duePaid = new Prisma.Decimal(due.amountPaid);
                const dueRemaining = dueTotal.minus(duePaid);
                if (dueRemaining.lessThanOrEqualTo(0)) continue;

                const allocation = {
                    loanDueId: due.id,
                    dueSequence: due.dueSequence,
                    penalty: new Prisma.Decimal(0),
                    interest: new Prisma.Decimal(0),
                    principal: new Prisma.Decimal(0),
                    total: new Prisma.Decimal(0),
                };

                if (remaining.greaterThanOrEqualTo(dueRemaining)) {
                    allocation.total = dueRemaining;

                    let leftover = dueRemaining;
                    // penalty remaining
                    const penaltyDue = new Prisma.Decimal(due.penaltyDue);
                    const principalDue = new Prisma.Decimal(due.principalDue);
                    const interestDue = new Prisma.Decimal(due.interestDue);

                    const paidDiff = duePaid.minus(principalDue).minus(interestDue);
                    const penaltyPaid = Prisma.Decimal.max(0, paidDiff);
                    const penaltyRemaining = Prisma.Decimal.max(0, penaltyDue.minus(penaltyPaid));

                    const penaltyAlloc = Prisma.Decimal.min(leftover, penaltyRemaining);
                    allocation.penalty = penaltyAlloc;
                    leftover = leftover.minus(penaltyAlloc);

                    const interestAlloc = Prisma.Decimal.min(leftover, interestDue);
                    allocation.interest = interestAlloc;
                    leftover = leftover.minus(interestAlloc);

                    allocation.principal = leftover;

                    await tx.loanDue.update({
                        where: { id: due.id },
                        data: {
                            amountPaid: dueTotal,
                            status: 'paid'
                        }
                    });

                    remaining = remaining.minus(dueRemaining);
                } else {
                    allocation.total = remaining;

                    let leftover = remaining;
                    const penaltyDue = new Prisma.Decimal(due.penaltyDue);
                    const interestDue = new Prisma.Decimal(due.interestDue);

                    const penaltyAlloc = Prisma.Decimal.min(leftover, penaltyDue);
                    allocation.penalty = penaltyAlloc;
                    leftover = leftover.minus(penaltyAlloc);

                    const interestAlloc = Prisma.Decimal.min(leftover, interestDue);
                    allocation.interest = interestAlloc;
                    leftover = leftover.minus(interestAlloc);

                    allocation.principal = leftover;

                    await tx.loanDue.update({
                        where: { id: due.id },
                        data: {
                            amountPaid: duePaid.plus(remaining),
                            status: 'pending'
                        }
                    });

                    remaining = new Prisma.Decimal(0);
                }

                allocationDetails.push({
                    loanDueId: allocation.loanDueId,
                    dueSequence: allocation.dueSequence,
                    penalty: allocation.penalty.toNumber(),
                    interest: allocation.interest.toNumber(),
                    principal: allocation.principal.toNumber(),
                    total: allocation.total.toNumber(),
                });
            }

            const paymentId = uuidv4();
            const payment = await tx.payment.create({
                data: {
                    id: paymentId,
                    orgId,
                    loanId,
                    amount: amount.toNumber(),
                    paymentMethod,
                    referenceNumber,
                    allocationDetails: allocationDetails,
                    createdBy,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date()
                }
            });

            // Increment and update receipt sequence
            const org = await tx.organization.findUnique({ where: { id: orgId } });
            const settings = org?.settings || {};
            const lastSeq = settings.lastReceiptSequence !== undefined ? Number(settings.lastReceiptSequence) : 0;
            const nextSeq = lastSeq + 1;
            await tx.organization.update({
                where: { id: orgId },
                data: {
                    settings: {
                        ...settings,
                        lastReceiptSequence: nextSeq
                    }
                }
            });

            // Generate sequential unique receipt number
            const shortOrgCode = org.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
            const paddedSeq = String(nextSeq).padStart(6, '0');
            const receiptNumber = `RCP-${shortOrgCode}-${paddedSeq}`;

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

        const monthlyInterestNew = new Prisma.Decimal((quote.newInterestAccrued / quote.elapsedMonths).toFixed(2));

        // 4. Close the loan
        const loan = await tx.loan.update({
            where: { id: loanId },
            data: {
                tenureMonths: quote.elapsedMonths,
                monthlyInterestRate: quote.newRate,
                monthlyInterestAmount: monthlyInterestNew,
                monthlyPrincipalAmount: monthlyPrincipal,
                monthlyDueAmount: monthlyPrincipal.plus(monthlyInterestNew),
                outstandingPrincipal: new Prisma.Decimal(0),
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
            details: { quote, amount: amount.toNumber() }
        });

        return { loan, payment: paymentResult };
    });
}

async function closeLoan(orgId, loanId, userId) {
    const loan = await prisma.loan.findFirst({
        where: { id: loanId, orgId },
        include: { loanDues: true }
    });

    if (!loan) {
        throw new Error('Loan not found');
    }

    const allDuesPaid = loan.loanDues.every(d => d.status === 'paid' || Number(d.amountPaid) >= Number(d.totalDue));
    if (!allDuesPaid) {
        throw new Error('Cannot close loan: not all dues are paid');
    }

    const updatedLoan = await prisma.loan.update({
        where: { id: loanId },
        data: {
            status: 'closed'
        }
    });

    const { logAudit } = require('./audit.service');
    await logAudit({
        orgId,
        userId,
        action: 'loan_closed',
        entityType: 'loan',
        entityId: loanId,
        metadata: { closedAt: new Date().toISOString() }
    });

    return updatedLoan;
}

module.exports = { generateSchedule, createLoan, getLoanById, listLoans, calculateForeclosureQuote, executeForeclosure, closeLoan };

