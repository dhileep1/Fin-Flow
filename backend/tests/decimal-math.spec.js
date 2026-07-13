const prisma = require('../src/config/database');
const { recordPayment } = require('../src/services/payment.service');
const { accrueDailyPenalties } = require('../src/services/penalty.service');
const { Prisma } = require('@prisma/client');

const mockTx = {
    loanDue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    loan: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    payment: {
        create: jest.fn(),
    },
    receipt: {
        create: jest.fn(),
    },
    organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Decimal Test', settings: {} }),
        update: jest.fn(),
    },
    penalty: {
        create: jest.fn(),
    },
};

jest.mock('../src/config/database', () => {
    return {
        $transaction: jest.fn((callback) => callback(mockTx)),
        loanDue: {
            findMany: jest.fn(),
        },
        receipt: {
            update: jest.fn()
        },
        notification: {
            create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
            update: jest.fn(),
        },
        customer: {
            findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', phone: '9988776655', optOutWhatsapp: false })
        },
        auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
        },
    };
});

describe('Money Math Precision (Prisma.Decimal Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate penalty accrual with high precision using Decimal.js', async () => {
        const today = new Date('2026-07-12T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(today);

        // Due date is overdue
        const mockDue = {
            id: 'due-1',
            dueDate: new Date('2026-07-09T00:00:00.000Z'),
            orgId: 'org-1',
            loanId: 'loan-1',
            status: 'pending',
        };

        prisma.loanDue.findMany.mockResolvedValue([mockDue]);

        // Principal and Interest configured so floats would drift:
        // principalDue = 1000.03, interestDue = 200.07, amountPaid = 0.05
        // baseDue = 1000.03 + 200.07 = 1200.10
        // pendingDue = 1200.10 - 0.05 = 1200.05
        // penaltyRate = 0.00002
        // dailyPenalty = 1200.05 * 0.00002 = 0.024001 => 0.02 rounded
        mockTx.loanDue.findUnique.mockResolvedValue({
            ...mockDue,
            principalDue: new Prisma.Decimal(1000.03),
            interestDue: new Prisma.Decimal(200.07),
            amountPaid: new Prisma.Decimal(0.05),
            penaltyDue: new Prisma.Decimal(0),
            totalDue: new Prisma.Decimal(1200.10),
            penalties: [],
        });

        const result = await accrueDailyPenalties('org-1');

        // Missed dates: 2026-07-10, 2026-07-11, 2026-07-12 (3 days)
        // Total penalty: 0.02 * 3 = 0.06
        expect(result.totalPenaltiesAccrued).toBe(0.06);

        expect(mockTx.loanDue.update).toHaveBeenCalledWith({
            where: { id: 'due-1' },
            data: {
                penaltyDue: { increment: new Prisma.Decimal(0.06) },
                totalDue: { increment: new Prisma.Decimal(0.06) },
            }
        });

        jest.useRealTimers();
    });

    it('should allocate partial payment and update outstanding balance correctly using Decimal', async () => {
        const mockDues = [
            { id: 'due-1', dueSequence: 1, totalDue: new Prisma.Decimal(125.07), amountPaid: new Prisma.Decimal(0), penaltyDue: new Prisma.Decimal(5.01), interestDue: new Prisma.Decimal(20.03), principalDue: new Prisma.Decimal(100.03) },
        ];
        mockTx.loanDue.findMany.mockResolvedValue(mockDues);
        mockTx.loan.findUnique.mockResolvedValue({ id: 'loan-1', outstandingPrincipal: new Prisma.Decimal(1000.05) });
        mockTx.loanDue.count.mockResolvedValue(1);
        mockTx.payment.create.mockImplementation(({ data }) => Promise.resolve({ id: 'payment-1', ...data }));
        mockTx.receipt.create.mockResolvedValue({ id: 'receipt-1' });

        const result = await recordPayment({
            orgId: 'org-1',
            loanId: 'loan-1',
            amount: 110.05,
            paymentMethod: 'cash',
            createdBy: 'user-1'
        });

        // Allocation details: penalty=5.01, interest=20.03, principal=85.01 (total 110.05)
        expect(result.allocationDetails[0]).toEqual({
            loanDueId: 'due-1',
            dueSequence: 1,
            penalty: 5.01,
            interest: 20.03,
            principal: 85.01,
            total: 110.05,
        });

        // Outstanding Principal: 1000.05 - 85.01 = 915.04
        expect(mockTx.loan.update).toHaveBeenCalledWith({
            where: { id: 'loan-1' },
            data: {
                outstandingPrincipal: new Prisma.Decimal(915.04),
                status: 'active',
            }
        });
    });
});
