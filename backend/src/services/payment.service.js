const prisma = require('../config/database');
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
        const totalOutstanding = dues.reduce((sum, due) => sum + roundHalfUp(Number(due.totalDue) - Number(due.amountPaid)), 0);
        if (remaining > roundHalfUp(totalOutstanding + 0.05)) {
            throw new Error(`Payment amount ${amount} exceeds the total outstanding balance of ${roundHalfUp(totalOutstanding)}`);
        }

        // Get organization and settings for dynamic allocation and receipt sequencing
        const org = await tx.organization.findUnique({
            where: { id: orgId }
        });
        const settings = org?.settings || {};
        const allocationOrder = settings.allocationOrder || ['penalty', 'interest', 'principal'];

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

            // Determine how much of the existing due.amountPaid was allocated to components dynamically
            const amountPaidSoFar = Number(due.amountPaid);
            let currentPaidRemaining = amountPaidSoFar;
            const paidComponents = { penalty: 0, interest: 0, principal: 0 };
            
            for (const component of allocationOrder) {
                const limitValue = Number(component === 'penalty' ? due.penaltyDue : (component === 'interest' ? due.interestDue : due.principalDue));
                const allocated = Math.min(currentPaidRemaining, limitValue);
                paidComponents[component] = allocated;
                currentPaidRemaining = roundHalfUp(currentPaidRemaining - allocated);
            }
            if (currentPaidRemaining > 0 && allocationOrder.length > 0) {
                const lastComponent = allocationOrder[allocationOrder.length - 1];
                paidComponents[lastComponent] = roundHalfUp(paidComponents[lastComponent] + currentPaidRemaining);
            }

            // Unpaid portions of components
            const penaltyUnpaid = roundHalfUp(Number(due.penaltyDue) - paidComponents.penalty);
            const interestUnpaid = roundHalfUp(Number(due.interestDue) - paidComponents.interest);
            const principalUnpaid = roundHalfUp(Number(due.principalDue) - paidComponents.principal);

            const unpaidComponents = {
                penalty: penaltyUnpaid,
                interest: interestUnpaid,
                principal: principalUnpaid
            };

            // Allocate paymentToApply across unpaid components based on configured order
            let leftover = paymentToApply;
            for (const component of allocationOrder) {
                if (leftover <= 0) break;
                const unpaidVal = unpaidComponents[component];
                const alloc = Math.min(leftover, unpaidVal);
                allocation[component] = roundHalfUp(alloc);
                leftover = roundHalfUp(leftover - alloc);
            }
            if (leftover > 0 && allocationOrder.length > 0) {
                const lastComponent = allocationOrder[allocationOrder.length - 1];
                allocation[lastComponent] = roundHalfUp(allocation[lastComponent] + leftover);
            }

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

        return { payment, receipt, allocationDetails, creditBalance: roundHalfUp(remaining), customerId: loan.customerId };
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
