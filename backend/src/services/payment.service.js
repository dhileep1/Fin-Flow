const prisma = require('../config/database');
const { roundHalfUp } = require('../utils/rounding');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Record a payment against a loan.
 * Applies payment in order: penalty → interest → principal (configurable per-tenant).
 * Iterates dues oldest first.
 */
async function recordPayment({ orgId, loanId, amount, paymentMethod, referenceNumber, createdBy, paymentDate }) {
    let remaining = Number(amount);
    const allocationDetails = [];

    const result = await prisma.$transaction(async (tx) => {
        // Get unpaid dues ordered by due_date ascending
        const dues = await tx.loanDue.findMany({
            where: { orgId, loanId, status: { not: 'paid' } },
            orderBy: { dueDate: 'asc' },
        });

        for (const due of dues) {
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
                // Full payment of this due
                allocation.total = dueRemaining;

                // Allocate to components in order: penalty, interest, principal
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
                        status: 'paid',
                    },
                });

                remaining = roundHalfUp(remaining - dueRemaining);
            } else {
                // Partial payment
                allocation.total = roundHalfUp(remaining);

                // Allocate remaining in order: penalty, interest, principal
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
                        status: 'pending',
                    },
                });

                remaining = 0;
            }

            allocationDetails.push(allocation);
        }

        // Compute total principal paid in this payment
        const totalPrincipalPaid = allocationDetails.reduce((sum, a) => sum + a.principal, 0);

        // Update loan outstanding
        const loan = await tx.loan.findUnique({ where: { id: loanId } });
        const newOutstanding = roundHalfUp(Number(loan.outstandingPrincipal) - totalPrincipalPaid);

        // Check if loan should be closed
        const unpaidDues = await tx.loanDue.count({
            where: { loanId, status: { not: 'paid' } },
        });

        await tx.loan.update({
            where: { id: loanId },
            data: {
                outstandingPrincipal: Math.max(0, newOutstanding),
                status: unpaidDues === 0 && newOutstanding <= 0 ? 'closed' : 'active',
            },
        });

        // Create payment record
        const paymentId = uuidv4();
        const payment = await tx.payment.create({
            data: {
                id: paymentId,
                orgId,
                loanId,
                amount: Number(amount),
                paymentMethod,
                referenceNumber,
                allocationDetails: allocationDetails,
                createdBy,
                ...(paymentDate && { paymentDate: new Date(paymentDate) }),
            },
        });

        // Generate receipt
        const receiptNumber = `RCP-${Date.now()}-${paymentId.slice(0, 8).toUpperCase()}`;
        const receipt = await tx.receipt.create({
            data: {
                id: uuidv4(),
                orgId,
                paymentId,
                receiptNumber,
            },
        });

        return { payment, receipt, allocationDetails, creditBalance: roundHalfUp(remaining) };
    });

    // Audit log
    await logAudit({
        orgId,
        userId: createdBy,
        action: 'payment_recorded',
        entityType: 'payment',
        entityId: result.payment.id,
        details: { loanId, amount, allocationDetails, creditBalance: result.creditBalance },
    });

    return result;
}

/**
 * Get payments for a loan.
 */
async function getPaymentsByLoan(orgId, loanId) {
    return prisma.payment.findMany({
        where: { orgId, loanId },
        include: { receipts: true, creator: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
    });
}

/**
 * Get all payments for an organization.
 */
async function getAllPayments(orgId) {
    return prisma.payment.findMany({
        where: { orgId },
        include: {
            loan: {
                include: {
                    customer: { select: { name: true } },
                },
            },
            creator: { select: { name: true } },
            receipts: { select: { receiptNumber: true } },
        },
        orderBy: { paymentDate: 'desc' },
    });
}

module.exports = { recordPayment, getPaymentsByLoan, getAllPayments };
