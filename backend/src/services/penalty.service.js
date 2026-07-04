const prisma = require('../config/database');
const { roundHalfUp } = require('../utils/rounding');
const { v4: uuidv4 } = require('uuid');

/**
 * Accrue daily penalties for all overdue unpaid dues.
 * 
 * Daily penalty = round(pending_due * 0.00002, 2)
 * pending_due = total_due - amount_paid (excluding penalties for non-compounding)
 * 
 * Idempotent: skips dues that already have a penalty entry for today.
 */
async function accrueDailyPenalties(orgId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
        dueDate: { lt: today },
        status: { not: 'paid' },
        loan: {
            status: { notIn: ['seized', 'closed'] }
        }
    };
    if (orgId) where.orgId = orgId;

    // Find all overdue unpaid dues
    const overdueDues = await prisma.loanDue.findMany({
        where,
        include: {
            penalties: {
                where: { penaltyDate: today },
            },
        },
    });

    let totalPenaltiesAccrued = 0;
    const penaltiesCreated = [];

    for (const due of overdueDues) {
        // Skip if already processed today (idempotency)
        if (due.penalties.length > 0) continue;

        // Non-compounding: pending = (principalDue + interestDue) - amountPaid
        // Only use base due (excl. penalty) for non-compounding calculation
        const baseDue = Number(due.principalDue) + Number(due.interestDue);
        const pendingDue = Math.max(0, baseDue - Number(due.amountPaid));

        if (pendingDue <= 0) continue;

        const dailyPenalty = roundHalfUp(pendingDue * 0.00002);
        if (dailyPenalty <= 0) continue;

        try {
            await prisma.$transaction(async (tx) => {
                // Insert penalty record
                await tx.penalty.create({
                    data: {
                        id: uuidv4(),
                        orgId: due.orgId,
                        loanDueId: due.id,
                        penaltyDate: today,
                        penaltyAmount: dailyPenalty,
                    },
                });

                // Update loan_due
                await tx.loanDue.update({
                    where: { id: due.id },
                    data: {
                        penaltyDue: roundHalfUp(Number(due.penaltyDue) + dailyPenalty),
                        totalDue: roundHalfUp(Number(due.totalDue) + dailyPenalty),
                    },
                });

                // Update loan accrued penalty
                await tx.loan.update({
                    where: { id: due.loanId },
                    data: {
                        accruedPenalty: { increment: dailyPenalty },
                    },
                });
            });

            totalPenaltiesAccrued += dailyPenalty;
            penaltiesCreated.push({
                loanDueId: due.id,
                penaltyAmount: dailyPenalty,
            });
        } catch (err) {
            // Unique constraint violation means already processed — skip
            if (err.code === 'P2002') continue;
            throw err;
        }
    }

    return {
        processedDate: today,
        duesProcessed: penaltiesCreated.length,
        totalPenaltiesAccrued: roundHalfUp(totalPenaltiesAccrued),
        details: penaltiesCreated,
    };
}

module.exports = { accrueDailyPenalties };
