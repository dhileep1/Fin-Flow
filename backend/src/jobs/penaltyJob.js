const { accrueDailyPenalties } = require('../services/penalty.service');
const logger = require('../utils/logger');

/**
 * Penalty accrual job — runs daily at 00:05.
 * Idempotent via unique constraint on (loan_due_id, penalty_date).
 */
async function runPenaltyJob() {
    logger.info('[PenaltyJob] Starting daily penalty accrual...');
    try {
        const result = await accrueDailyPenalties();
        logger.info(`[PenaltyJob] Completed: ${result.duesProcessed} dues processed, ₹${result.totalPenaltiesAccrued} accrued`);
        return result;
    } catch (err) {
        logger.error('[PenaltyJob] Failed', { error: err.message, stack: err.stack });
        throw err;
    }
}

module.exports = { runPenaltyJob };
