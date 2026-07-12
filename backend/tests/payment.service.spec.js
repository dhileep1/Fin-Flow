const prisma = require('../src/config/database');
const { recordPayment } = require('../src/services/payment.service');

const mockTx = {
    loanDue: {
        findMany: jest.fn(),
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
};

jest.mock('../src/config/database', () => {
    return {
        $transaction: jest.fn((callback) => callback(mockTx)),
        loanDue: {
            findMany: jest.fn(),
            update: jest.fn(),
        },
        loan: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
        },
    };
});

describe('Payment Service - recordPayment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should reject payment if the amount exceeds the total outstanding balance plus tolerance', async () => {
        const mockDues = [
            { id: 'due-1', dueSequence: 1, totalDue: 120, amountPaid: 0, penaltyDue: 0, interestDue: 20, principalDue: 100 },
        ];
        mockTx.loanDue.findMany.mockResolvedValue(mockDues);

        await expect(recordPayment({
            orgId: 'org-1',
            loanId: 'loan-1',
            amount: 200,
            paymentMethod: 'cash',
            createdBy: 'user-1'
        })).rejects.toThrow('Payment amount 200 exceeds the total outstanding balance of 120');
    });

    it('should correctly allocate a partial payment in order: penalty -> interest -> principal', async () => {
        const mockDues = [
            { id: 'due-1', dueSequence: 1, totalDue: 125, amountPaid: 0, penaltyDue: 5, interestDue: 20, principalDue: 100 },
        ];
        mockTx.loanDue.findMany.mockResolvedValue(mockDues);
        mockTx.loan.findUnique.mockResolvedValue({ id: 'loan-1', outstandingPrincipal: 1000 });
        mockTx.loanDue.count.mockResolvedValue(1);
        mockTx.payment.create.mockImplementation(({ data }) => Promise.resolve({ id: 'payment-1', ...data }));
        mockTx.receipt.create.mockResolvedValue({ id: 'receipt-1' });

        const result = await recordPayment({
            orgId: 'org-1',
            loanId: 'loan-1',
            amount: 110,
            paymentMethod: 'cash',
            createdBy: 'user-1'
        });

        // Allocation should be: penalty=5, interest=20, principal=85 (total 110)
        expect(result.allocationDetails[0]).toEqual({
            loanDueId: 'due-1',
            dueSequence: 1,
            penalty: 5,
            interest: 20,
            principal: 85,
            total: 110,
        });

        expect(mockTx.loanDue.update).toHaveBeenCalledWith({
            where: { id: 'due-1' },
            data: {
                amountPaid: 110,
                status: 'pending',
            }
        });
    });

    it('should correctly allocate a subsequent payment to pay off remaining due balance without double counting', async () => {
        // Due state has already been partially paid (amountPaid = 110)
        const mockDues = [
            { id: 'due-1', dueSequence: 1, totalDue: 125, amountPaid: 110, penaltyDue: 5, interestDue: 20, principalDue: 100 },
        ];
        mockTx.loanDue.findMany.mockResolvedValue(mockDues);
        mockTx.loan.findUnique.mockResolvedValue({ id: 'loan-1', outstandingPrincipal: 915 });
        mockTx.loanDue.count.mockResolvedValue(0);
        mockTx.payment.create.mockImplementation(({ data }) => Promise.resolve({ id: 'payment-2', ...data }));
        mockTx.receipt.create.mockResolvedValue({ id: 'receipt-2' });

        const result = await recordPayment({
            orgId: 'org-1',
            loanId: 'loan-1',
            amount: 15,
            paymentMethod: 'cash',
            createdBy: 'user-1'
        });

        // Remaining was 15, which goes entirely to principal (since penalty & interest were fully paid in first payment)
        expect(result.allocationDetails[0]).toEqual({
            loanDueId: 'due-1',
            dueSequence: 1,
            penalty: 0,
            interest: 0,
            principal: 15,
            total: 15,
        });

        expect(mockTx.loanDue.update).toHaveBeenCalledWith({
            where: { id: 'due-1' },
            data: {
                amountPaid: 125,
                status: 'paid',
            }
        });
    });
});
