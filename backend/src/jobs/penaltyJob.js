const { accrueDailyPenalties } = require('../services/penalty.service');

/**
 * Penalty accrual job — runs daily at 00:05.
 * Idempotent via unique constraint on (loan_due_id, penalty_date).
 */
async function runPenaltyJob() {
    console.log('[PenaltyJob] Starting daily penalty accrual...');
    try {
        const result = await accrueDailyPenalties();
        console.log(`[PenaltyJob] Completed: ${result.duesProcessed} dues processed, ₹${result.totalPenaltiesAccrued} accrued`);
        return result;
    } catch (err) {
        console.error('[PenaltyJob] Failed:', err.message);
        throw err;
    }
}

module.exports = { runPenaltyJob };
