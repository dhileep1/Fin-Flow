const { recordPayment } = require('../src/services/payment.service');
const { executeForeclosure } = require('../src/services/loan.service');
const validate = require('../src/middleware/validate');
const { createPaymentSchema } = require('../src/utils/validation.schemas');

jest.mock('../src/config/database', () => ({}));
jest.mock('../src/services/audit.service', () => ({ logAudit: jest.fn() }));

describe('Payment Date Bounds Checks', () => {
    describe('recordPayment service level validation', () => {
        it('should throw an error for a future payment date', async () => {
            const futureDate = new Date();
            futureDate.setMinutes(futureDate.getMinutes() + 10); // 10 mins in future

            await expect(recordPayment({
                orgId: 'org-1',
                loanId: 'loan-1',
                amount: 100,
                paymentMethod: 'cash',
                createdBy: 'user-1',
                paymentDate: futureDate.toISOString()
            })).rejects.toThrow('Payment date cannot be in the future');
        });

        it('should throw an error for a payment date more than 3 days in the past', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 4); // 4 days ago

            await expect(recordPayment({
                orgId: 'org-1',
                loanId: 'loan-1',
                amount: 100,
                paymentMethod: 'cash',
                createdBy: 'user-1',
                paymentDate: pastDate.toISOString()
            })).rejects.toThrow('Payment date cannot be backdated by more than 3 days');
        });
    });

    describe('executeForeclosure service level validation', () => {
        it('should throw an error for a future foreclosure payment date', async () => {
            const futureDate = new Date();
            futureDate.setMinutes(futureDate.getMinutes() + 10);

            await expect(executeForeclosure('org-1', 'loan-1', {
                foreclosureRate: 0.01,
                paymentMethod: 'cash',
                createdBy: 'user-1',
                paymentDate: futureDate.toISOString()
            })).rejects.toThrow('Payment date cannot be in the future');
        });

        it('should throw an error for a foreclosure date more than 3 days in the past', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 4);

            await expect(executeForeclosure('org-1', 'loan-1', {
                foreclosureRate: 0.01,
                paymentMethod: 'cash',
                createdBy: 'user-1',
                paymentDate: pastDate.toISOString()
            })).rejects.toThrow('Payment date cannot be backdated by more than 3 days');
        });
    });

    describe('createPaymentSchema Zod validation', () => {
        it('should fail validation middleware if paymentDate is in the future', () => {
            const futureDate = new Date();
            futureDate.setMinutes(futureDate.getMinutes() + 10);

            const req = {
                body: {
                    loanId: 'a123bc45-e678-f901-2345-6789abcdef01',
                    amount: 100,
                    paymentMethod: 'cash',
                    paymentDate: futureDate.toISOString(),
                },
                query: {},
                params: {},
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();

            const middleware = validate(createPaymentSchema);
            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('Payment date cannot be in the future')
                ])
            });
        });
    });
});
