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
    today.setUTCHours(0, 0, 0, 0);

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
    });

    let totalPenaltiesAccrued = 0;
    const penaltiesCreated = [];

    for (const due of overdueDues) {
        try {
            await prisma.$transaction(async (tx) => {
                // Fetch the latest state of the due inside the transaction to avoid stale read
                const currentDue = await tx.loanDue.findUnique({
                    where: { id: due.id },
                    include: { penalties: true }
                });

                if (!currentDue || currentDue.status === 'paid') return;

                // Non-compounding: pending = (principalDue + interestDue) - amountPaid
                const baseDue = Number(currentDue.principalDue) + Number(currentDue.interestDue);
                const pendingDue = Math.max(0, baseDue - Number(currentDue.amountPaid));

                if (pendingDue <= 0) return;

                // Load tenant-configurable penalty rate and grace period
                const org = await tx.organization.findUnique({
                    where: { id: currentDue.orgId }
                });
                const settings = org?.settings || {};
                const penaltyRate = settings.penaltyRate !== undefined ? Number(settings.penaltyRate) : 0.00002;
                const gracePeriodDays = settings.gracePeriodDays !== undefined ? Number(settings.gracePeriodDays) : 0;

                const dailyPenalty = roundHalfUp(pendingDue * penaltyRate);
                if (dailyPenalty <= 0) return;

                // Calculate missing dates from currentDue.dueDate + 1 day + gracePeriodDays to today (inclusive)
                const startRangeDate = new Date(currentDue.dueDate);
                startRangeDate.setUTCDate(startRangeDate.getUTCDate() + 1 + gracePeriodDays);
                startRangeDate.setUTCHours(0, 0, 0, 0);

                const endRangeDate = new Date(today);
                endRangeDate.setUTCHours(0, 0, 0, 0);

                const missingDates = [];
                const existingDatesSet = new Set(
                    currentDue.penalties.map(p => {
                        const d = new Date(p.penaltyDate);
                        d.setUTCHours(0, 0, 0, 0);
                        return d.getTime();
                    })
                );

                let cur = new Date(startRangeDate);
                while (cur <= endRangeDate) {
                    if (!existingDatesSet.has(cur.getTime())) {
                        missingDates.push(new Date(cur));
                    }
                    cur.setUTCDate(cur.getUTCDate() + 1);
                }

                if (missingDates.length === 0) return;

                const totalPenaltyForMissedDays = roundHalfUp(dailyPenalty * missingDates.length);

                // Create penalty records for all missing days
                for (const mDate of missingDates) {
                    await tx.penalty.create({
                        data: {
                            id: uuidv4(),
                            orgId: currentDue.orgId,
                            loanDueId: currentDue.id,
                            penaltyDate: mDate,
                            penaltyAmount: dailyPenalty,
                        },
                    });
                }

                // Update loan_due with atomic increments
                await tx.loanDue.update({
                    where: { id: currentDue.id },
                    data: {
                        penaltyDue: { increment: totalPenaltyForMissedDays },
                        totalDue: { increment: totalPenaltyForMissedDays },
                    },
                });

                // Update loan accrued penalty
                await tx.loan.update({
                    where: { id: currentDue.loanId },
                    data: {
                        accruedPenalty: { increment: totalPenaltyForMissedDays },
                    },
                });

                totalPenaltiesAccrued += totalPenaltyForMissedDays;
                penaltiesCreated.push({
                    loanDueId: currentDue.id,
                    penaltyAmount: totalPenaltyForMissedDays,
                    daysAccrued: missingDates.length,
                });
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
