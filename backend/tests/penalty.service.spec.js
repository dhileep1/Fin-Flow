const prisma = require('../src/config/database');
const { accrueDailyPenalties } = require('../src/services/penalty.service');

const mockTx = {
    loanDue: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    loan: {
        update: jest.fn(),
    },
    penalty: {
        create: jest.fn(),
    },
    organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org-1', name: 'QuickLoans Pvt Ltd', settings: {} }),
        update: jest.fn(),
    },
};

jest.mock('../src/config/database', () => {
    return {
        $transaction: jest.fn((callback) => callback(mockTx)),
        loanDue: {
            findMany: jest.fn(),
        },
    };
});

describe('Penalty Service - accrueDailyPenalties', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly backfill missing penalty days and update due and loan records atomically', async () => {
        // Set up dates
        // Let's say today is 2026-07-12
        const today = new Date('2026-07-12T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(today);

        // Due date is 2026-07-09. Overdue since 2026-07-10, 2026-07-11, 2026-07-12 (3 days)
        const mockOverdueDue = {
            id: 'due-1',
            dueDate: new Date('2026-07-09T00:00:00.000Z'),
            orgId: 'org-1',
            loanId: 'loan-1',
            status: 'pending',
        };

        prisma.loanDue.findMany.mockResolvedValue([mockOverdueDue]);

        // Inside transaction: fetch due with its existing penalties
        // In this case, we have no existing penalties
        mockTx.loanDue.findUnique.mockResolvedValue({
            ...mockOverdueDue,
            principalDue: 1000,
            interestDue: 200,
            amountPaid: 0,
            penaltyDue: 0,
            totalDue: 1200,
            penalties: [], // no penalties accrued yet
        });

        const result = await accrueDailyPenalties('org-1');

        // pendingDue = (1000 + 200) - 0 = 1200
        // dailyPenalty = roundHalfUp(1200 * 0.00002) = 0.02
        // Missed dates: 2026-07-10, 2026-07-11, 2026-07-12 (3 days)
        // Total penalty: 0.02 * 3 = 0.06

        expect(result.totalPenaltiesAccrued).toBe(0.06);
        expect(result.duesProcessed).toBe(1);

        // Should create 3 penalty records
        expect(mockTx.penalty.create).toHaveBeenCalledTimes(3);
        expect(mockTx.penalty.create).toHaveBeenNthCalledWith(1, {
            data: {
                id: expect.any(String),
                orgId: 'org-1',
                loanDueId: 'due-1',
                penaltyDate: new Date('2026-07-10T00:00:00.000Z'),
                penaltyAmount: 0.02,
            }
        });

        // Should update loanDue atomically
        expect(mockTx.loanDue.update).toHaveBeenCalledWith({
            where: { id: 'due-1' },
            data: {
                penaltyDue: { increment: 0.06 },
                totalDue: { increment: 0.06 },
            }
        });

        // Should update loan atomically
        expect(mockTx.loan.update).toHaveBeenCalledWith({
            where: { id: 'loan-1' },
            data: {
                accruedPenalty: { increment: 0.06 }
            }
        });

        jest.useRealTimers();
    });

    it('should skip dates that already have penalty records (idempotency)', async () => {
        const today = new Date('2026-07-12T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(today);

        const mockOverdueDue = {
            id: 'due-1',
            dueDate: new Date('2026-07-09T00:00:00.000Z'),
            orgId: 'org-1',
            loanId: 'loan-1',
            status: 'pending',
        };

        prisma.loanDue.findMany.mockResolvedValue([mockOverdueDue]);

        // Existing penalty for 2026-07-10 and 2026-07-11
        mockTx.loanDue.findUnique.mockResolvedValue({
            ...mockOverdueDue,
            principalDue: 1000,
            interestDue: 200,
            amountPaid: 0,
            penaltyDue: 0.04,
            totalDue: 1200,
            penalties: [
                { penaltyDate: new Date('2026-07-10T00:00:00.000Z'), penaltyAmount: 0.02 },
                { penaltyDate: new Date('2026-07-11T00:00:00.000Z'), penaltyAmount: 0.02 },
            ],
        });

        const result = await accrueDailyPenalties('org-1');

        // Only 2026-07-12 is missing.
        // Total penalty: 0.02 * 1 = 0.02
        expect(result.totalPenaltiesAccrued).toBe(0.02);
        expect(mockTx.penalty.create).toHaveBeenCalledTimes(1);
        expect(mockTx.penalty.create).toHaveBeenCalledWith({
            data: {
                id: expect.any(String),
                orgId: 'org-1',
                loanDueId: 'due-1',
                penaltyDate: new Date('2026-07-12T00:00:00.000Z'),
                penaltyAmount: 0.02,
            }
        });

        jest.useRealTimers();
    });
});
