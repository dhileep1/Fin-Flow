const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const { roundHalfUp } = require('../utils/rounding');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');
const receiptService = require('./receipt.service');

/**
 * Record a payment against a loan.
 * Applies payment in order: penalty → interest → principal (configurable per-tenant).
 * Iterates dues oldest first.
 */
async function recordPayment({ orgId, loanId, amount, paymentMethod, referenceNumber, createdBy, paymentDate, idempotencyKey }) {
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

    if (idempotencyKey) {
        const existing = await prisma.payment.findFirst({
            where: { orgId, idempotencyKey },
            include: { receipts: true }
        });
        if (existing) {
            return {
                payment: existing,
                receipt: existing.receipts[0],
                allocationDetails: existing.allocationDetails,
                creditBalance: 0,
                isDuplicate: true
            };
        }
    }

    let remaining = Number(amount);
    const allocationDetails = [];

    const result = await prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
            const existing = await tx.payment.findFirst({
                where: { orgId, idempotencyKey },
                include: { receipts: true }
            });
            if (existing) {
                return {
                    payment: existing,
                    receipt: existing.receipts[0],
                    allocationDetails: existing.allocationDetails,
                    creditBalance: 0,
                    isDuplicate: true
                };
            }
        }

        // Get unpaid dues ordered by due_date ascending
        const dues = await tx.loanDue.findMany({
            where: { orgId, loanId, status: { not: 'paid' } },
            orderBy: { dueDate: 'asc' },
        });

        // 1. Overpayment validation: prevent payment exceeding total outstanding
        const totalOutstanding = dues.reduce((sum, due) => {
            const dueTotal = new Prisma.Decimal(due.totalDue);
            const duePaid = new Prisma.Decimal(due.amountPaid);
            return sum.plus(dueTotal.minus(duePaid));
        }, new Prisma.Decimal(0));

        const paymentAmount = new Prisma.Decimal(amount);
        if (paymentAmount.greaterThan(totalOutstanding.plus(0.05))) {
            throw new Error(`Payment amount ${amount} exceeds the total outstanding balance of ${totalOutstanding.toFixed(2)}`);
        }

        // Get organization and settings for dynamic allocation and receipt sequencing
        const org = await tx.organization.findUnique({
            where: { id: orgId }
        });
        const settings = org?.settings || {};
        const allocationOrder = settings.allocationOrder || ['penalty', 'interest', 'principal'];

        let remaining = paymentAmount;

        for (const due of dues) {
            if (remaining.lessThanOrEqualTo(0)) break;

            const dueTotal = new Prisma.Decimal(due.totalDue);
            const duePaidSoFar = new Prisma.Decimal(due.amountPaid);
            const dueRemaining = dueTotal.minus(duePaidSoFar);
            if (dueRemaining.lessThanOrEqualTo(0)) continue;

            const allocation = {
                loanDueId: due.id,
                dueSequence: due.dueSequence,
                penalty: new Prisma.Decimal(0),
                interest: new Prisma.Decimal(0),
                principal: new Prisma.Decimal(0),
                total: new Prisma.Decimal(0),
            };

            const paymentToApply = Prisma.Decimal.min(remaining, dueRemaining);
            allocation.total = paymentToApply;

            // Determine how much of the existing due.amountPaid was allocated to components dynamically
            let currentPaidRemaining = duePaidSoFar;
            const paidComponents = { penalty: new Prisma.Decimal(0), interest: new Prisma.Decimal(0), principal: new Prisma.Decimal(0) };
            
            for (const component of allocationOrder) {
                const limitValue = new Prisma.Decimal(component === 'penalty' ? due.penaltyDue : (component === 'interest' ? due.interestDue : due.principalDue));
                const allocated = Prisma.Decimal.min(currentPaidRemaining, limitValue);
                paidComponents[component] = allocated;
                currentPaidRemaining = currentPaidRemaining.minus(allocated);
            }
            if (currentPaidRemaining.greaterThan(0) && allocationOrder.length > 0) {
                const lastComponent = allocationOrder[allocationOrder.length - 1];
                paidComponents[lastComponent] = paidComponents[lastComponent].plus(currentPaidRemaining);
            }

            // Unpaid portions of components
            const penaltyUnpaid = new Prisma.Decimal(due.penaltyDue).minus(paidComponents.penalty);
            const interestUnpaid = new Prisma.Decimal(due.interestDue).minus(paidComponents.interest);
            const principalUnpaid = new Prisma.Decimal(due.principalDue).minus(paidComponents.principal);

            const unpaidComponents = {
                penalty: penaltyUnpaid,
                interest: interestUnpaid,
                principal: principalUnpaid
            };

            // Allocate paymentToApply across unpaid components based on configured order
            let leftover = paymentToApply;
            for (const component of allocationOrder) {
                if (leftover.lessThanOrEqualTo(0)) break;
                const unpaidVal = unpaidComponents[component];
                const alloc = Prisma.Decimal.min(leftover, unpaidVal);
                allocation[component] = alloc;
                leftover = leftover.minus(alloc);
            }
            if (leftover.greaterThan(0) && allocationOrder.length > 0) {
                const lastComponent = allocationOrder[allocationOrder.length - 1];
                allocation[lastComponent] = allocation[lastComponent].plus(leftover);
            }

            // Update the due
            const newAmountPaid = duePaidSoFar.plus(paymentToApply);
            const isPaid = newAmountPaid.greaterThanOrEqualTo(dueTotal.minus(0.01));

            await tx.loanDue.update({
                where: { id: due.id },
                data: {
                    amountPaid: newAmountPaid,
                    status: isPaid ? 'paid' : 'pending',
                },
            });

            remaining = remaining.minus(paymentToApply);
            
            allocationDetails.push({
                loanDueId: allocation.loanDueId,
                dueSequence: allocation.dueSequence,
                penalty: allocation.penalty.toNumber(),
                interest: allocation.interest.toNumber(),
                principal: allocation.principal.toNumber(),
                total: allocation.total.toNumber(),
            });
        }

        // Compute total principal paid in this payment
        const totalPrincipalPaid = allocationDetails.reduce((sum, a) => sum.plus(a.principal), new Prisma.Decimal(0));

        // Update loan outstanding
        const loan = await tx.loan.findUnique({ where: { id: loanId } });
        const newOutstanding = new Prisma.Decimal(loan.outstandingPrincipal).minus(totalPrincipalPaid);

        // Check if loan should be closed
        const unpaidDues = await tx.loanDue.count({
            where: { loanId, status: { not: 'paid' } },
        });

        await tx.loan.update({
            where: { id: loanId },
            data: {
                outstandingPrincipal: Prisma.Decimal.max(0, newOutstanding),
                status: unpaidDues === 0 && newOutstanding.lessThanOrEqualTo(0) ? 'closed' : 'active',
            },
        });

        // Create payment record
        const paymentId = uuidv4();
        const payment = await tx.payment.create({
            data: {
                id: paymentId,
                orgId,
                loanId,
                amount: paymentAmount.toNumber(),
                paymentMethod,
                referenceNumber,
                allocationDetails: allocationDetails,
                createdBy,
                idempotencyKey,
                ...(paymentDate && { paymentDate: new Date(paymentDate) }),
            },
        });

        // Increment and update receipt sequence
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

        const receipt = await tx.receipt.create({
            data: {
                id: uuidv4(),
                orgId,
                paymentId,
                receiptNumber,
            },
        });

        return { payment, receipt, allocationDetails, creditBalance: remaining.toNumber(), customerId: loan.customerId };
    });

    if (result.isDuplicate) {
        return result;
    }

    // Generate PDF, upload to S3, and update Receipt record
    try {
        const pdfBuffer = await receiptService.generateReceiptPDF(result.payment.id);
        const pdfUrl = await receiptService.uploadReceiptToS3(result.receipt.id, pdfBuffer);
        
        await prisma.receipt.update({
            where: { id: result.receipt.id },
            data: { pdfUrl }
        });
        result.receipt.pdfUrl = pdfUrl; // enrich response

        // Send WhatsApp notification
        const { sendNotification } = require('./notification.service');
        await sendNotification({
            orgId,
            customerId: result.customerId,
            loanId,
            type: 'receipt',
            messageBody: `Hi, we have received your payment of ₹${amount}. Your receipt is available here: ${pdfUrl}`,
            mediaUrl: pdfUrl
        });
        
        // Mark whatsappSent as true
        await prisma.receipt.update({
            where: { id: result.receipt.id },
            data: { whatsappSent: true }
        });
        result.receipt.whatsappSent = true; // enrich response
    } catch (err) {
        console.error('[Receipt PDF / WhatsApp Notification Error]:', err.message);
    }

    // Audit log
    await logAudit({
        orgId,
        userId: createdBy,
        action: 'payment_recorded',
        entityType: 'payment',
        entityId: result.payment.id,
        details: { loanId, amount, allocationDetails: result.allocationDetails, creditBalance: result.creditBalance },
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
