const prisma = require('../src/config/database');
const { executeForeclosure } = require('../src/services/loan.service');
const { Prisma } = require('@prisma/client');

const mockTx = {
    loanDue: {
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    loan: {
        update: jest.fn(),
    },
    payment: {
        create: jest.fn(),
    },
    receipt: {
        create: jest.fn(),
    },
    organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org-1', name: 'QuickLoans Pvt Ltd', settings: {} }),
        update: jest.fn(),
    },
    penalty: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { penaltyAmount: 0 } }),
    },
};

jest.mock('../src/config/database', () => {
    const { Prisma: localPrisma } = require('@prisma/client');
    return {
        $transaction: jest.fn((callback) => callback(mockTx)),
        loan: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'loan-1',
                orgId: 'org-1',
                principalAmount: new localPrisma.Decimal(10000),
                monthlyInterestRate: new localPrisma.Decimal(0.01),
                monthlyInterestAmount: new localPrisma.Decimal(100),
                monthlyPrincipalAmount: new localPrisma.Decimal(3333.33),
                monthlyDueAmount: new localPrisma.Decimal(3433.33),
                startDate: new Date('2026-07-12T00:00:00.000Z'),
                tenureMonths: 3,
                loanDues: [
                    { id: 'due-1', dueSequence: 1, totalDue: 3433.33, amountPaid: 3433.33, penaltyDue: 0 },
                    { id: 'due-2', dueSequence: 2, totalDue: 3433.33, amountPaid: 1000, penaltyDue: 0 },
                    { id: 'due-3', dueSequence: 3, totalDue: 3433.34, amountPaid: 0, penaltyDue: 0 }
                ]
            })
        },
        penalty: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { penaltyAmount: 0 } })
        },
        payment: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 4433.33 } }) // 3433.33 + 1000 paid so far
        },
        auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
        }
    };
});

describe('Loan Service - executeForeclosure', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock elapsed months calculations to be 2 months
        const today = new Date('2026-09-10T00:00:00.000Z');
        jest.useFakeTimers().setSystemTime(today);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should correctly re-allocate historical payments chronologically across updated foreclosure schedule', async () => {
        // Dues: Principal = 10000. Under new foreclosureRate of 0.005 (0.5%) for 2 elapsed months:
        // monthlyPrincipal = 10000 / 2 = 5000
        // monthlyInterest = 10000 * 0.005 = 50
        // New Dues: Sequence 1 total = 5050, Sequence 2 total = 5050. Total Liability = 10100.
        // Total Paid So Far = 4433.33
        // Foreclosure Amount = 10100 - 4433.33 = 5666.67

        const mockDues = [
            { id: 'due-1', dueSequence: 1, totalDue: 3433.33, amountPaid: 3433.33, penaltyDue: 0 },
            { id: 'due-2', dueSequence: 2, totalDue: 3433.33, amountPaid: 1000, penaltyDue: 0 }
        ];
        mockTx.loanDue.findMany
            .mockResolvedValueOnce(mockDues)  // first read to re-allocate
            .mockResolvedValueOnce([           // second read for foreclosure payment allocation
                { id: 'due-1', dueSequence: 1, totalDue: 5050, amountPaid: 4433.33, penaltyDue: 0, principalDue: 5000, interestDue: 50 },
                { id: 'due-2', dueSequence: 2, totalDue: 5050, amountPaid: 0, penaltyDue: 0, principalDue: 5000, interestDue: 50 }
            ]);

        mockTx.payment.create.mockResolvedValue({ id: 'payment-foreclosure' });

        const result = await executeForeclosure('org-1', 'loan-1', {
            foreclosureRate: 0.005,
            paymentMethod: 'cash',
            createdBy: 'user-1'
        });

        // 1. Check that future dues (sequence > 2) are deleted
        expect(mockTx.loanDue.deleteMany).toHaveBeenCalledWith({
            where: { loanId: 'loan-1', dueSequence: { gt: 2 } }
        });

        // 2. Check re-allocation updates of remaining dues
        // For due-1: totalDue = 5050. historical totalPaid = 4433.33. All goes to due-1.
        // amountPaid = 4433.33, status = pending
        expect(mockTx.loanDue.update).toHaveBeenNthCalledWith(1, {
            where: { id: 'due-1' },
            data: {
                principalDue: new Prisma.Decimal(5000),
                interestDue: new Prisma.Decimal(50),
                totalDue: new Prisma.Decimal(5050),
                amountPaid: new Prisma.Decimal(4433.33),
                status: 'pending'
            }
        });

        // For due-2: totalDue = 5050. remainingPaid = 0.
        // amountPaid = 0, status = upcoming
        expect(mockTx.loanDue.update).toHaveBeenNthCalledWith(2, {
            where: { id: 'due-2' },
            data: {
                principalDue: new Prisma.Decimal(5000),
                interestDue: new Prisma.Decimal(50),
                totalDue: new Prisma.Decimal(5050),
                amountPaid: new Prisma.Decimal(0),
                status: 'upcoming'
            }
        });

        // 3. Verify loan outstanding and closed status update
        expect(mockTx.loan.update).toHaveBeenCalledWith({
            where: { id: 'loan-1' },
            data: {
                tenureMonths: 2,
                monthlyInterestRate: 0.005,
                monthlyInterestAmount: new Prisma.Decimal(50),
                monthlyPrincipalAmount: new Prisma.Decimal(5000),
                monthlyDueAmount: new Prisma.Decimal(5050),
                outstandingPrincipal: new Prisma.Decimal(0),
                status: 'closed'
            }
        });
    });
});
