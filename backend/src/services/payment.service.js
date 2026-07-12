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

        // 1. Overpayment validation: prevent payment exceeding total outstanding
        const totalOutstanding = dues.reduce((sum, due) => sum + roundHalfUp(Number(due.totalDue) - Number(due.amountPaid)), 0);
        if (remaining > roundHalfUp(totalOutstanding + 0.05)) {
            throw new Error(`Payment amount ${amount} exceeds the total outstanding balance of ${roundHalfUp(totalOutstanding)}`);
        }

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

            const paymentToApply = Math.min(remaining, dueRemaining);
            allocation.total = roundHalfUp(paymentToApply);

            // Determine how much of the existing due.amountPaid was allocated to penalty, interest, principal
            // using the strict priority order: Penalty -> Interest -> Principal
            const amountPaidSoFar = Number(due.amountPaid);
            const penaltyPaid = Math.min(amountPaidSoFar, Number(due.penaltyDue));
            const interestPaid = Math.min(Math.max(0, amountPaidSoFar - Number(due.penaltyDue)), Number(due.interestDue));
            const principalPaid = Math.max(0, amountPaidSoFar - Number(due.penaltyDue) - Number(due.interestDue));

            // Unpaid portions of components
            const penaltyUnpaid = roundHalfUp(Number(due.penaltyDue) - penaltyPaid);
            const interestUnpaid = roundHalfUp(Number(due.interestDue) - interestPaid);
            const principalUnpaid = roundHalfUp(Number(due.principalDue) - principalPaid);

            // Allocate paymentToApply across unpaid components in order: Penalty -> Interest -> Principal
            let leftover = paymentToApply;

            const penaltyAlloc = Math.min(leftover, penaltyUnpaid);
            allocation.penalty = roundHalfUp(penaltyAlloc);
            leftover = roundHalfUp(leftover - penaltyAlloc);

            const interestAlloc = Math.min(leftover, interestUnpaid);
            allocation.interest = roundHalfUp(interestAlloc);
            leftover = roundHalfUp(leftover - interestAlloc);

            allocation.principal = roundHalfUp(leftover); // Remaining goes to principal

            // Update the due
            const newAmountPaid = roundHalfUp(amountPaidSoFar + paymentToApply);
            const isPaid = newAmountPaid >= Number(due.totalDue) - 0.01;

            await tx.loanDue.update({
                where: { id: due.id },
                data: {
                    amountPaid: newAmountPaid,
                    status: isPaid ? 'paid' : 'pending',
                },
            });

            remaining = roundHalfUp(remaining - paymentToApply);
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
