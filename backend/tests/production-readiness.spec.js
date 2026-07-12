const { encrypt, decrypt } = require('../src/utils/encryption');
const validate = require('../src/middleware/validate');
const { loginSchema, createCustomerSchema } = require('../src/utils/validation.schemas');
const paymentService = require('../src/services/payment.service');
const prisma = require('../src/config/database');

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
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    receipt: {
        create: jest.fn(),
    },
    organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
    }
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
        payment: {
            findFirst: jest.fn(),
            findUnique: jest.fn().mockResolvedValue({
                id: 'payment-1',
                amount: 110,
                paymentDate: new Date(),
                paymentMethod: 'cash',
                loanId: 'loan-1',
                org: { name: 'QuickLoans Pvt Ltd' },
                loan: {
                    customer: { name: 'Suresh Babu', phone: '9988776655' },
                    vehicle: { vehicleNumber: 'KA-01-AB-1234', model: 'Honda Activa' }
                },
                receipts: [{ receiptNumber: 'RCP-QUI-000006' }],
                allocationDetails: [{ dueSequence: 1, principal: 100, interest: 10, penalty: 0, total: 110 }]
            })
        },
        receipt: {
            update: jest.fn()
        },
        notification: {
            create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
            update: jest.fn(),
            findFirst: jest.fn(),
        },
        customer: {
            findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', phone: '9988776655', optOutWhatsapp: false })
        },
        auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
        },
    };
});

describe('Production Readiness Features', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Symmetric PII Encryption', () => {
        it('should correctly encrypt and decrypt text', () => {
            const secret = '1234-5678-9012';
            const cipherText = encrypt(secret);
            expect(cipherText).not.toBe(secret);
            expect(cipherText).toContain(':');

            const plainText = decrypt(cipherText);
            expect(plainText).toBe(secret);
        });

        it('should return original value if decrypting unencrypted text', () => {
            expect(decrypt('1234-5678-9012')).toBe('1234-5678-9012');
            expect(decrypt('')).toBe('');
            expect(decrypt(null)).toBe(null);
        });
    });

    describe('Zod Validation Middleware', () => {
        it('should call next() if schema validation passes', () => {
            const req = {
                body: { email: 'admin@quickloans.com', password: 'admin123' },
                query: {},
                params: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            const middleware = validate(loginSchema);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 400 with details if validation fails', () => {
            const req = {
                body: { email: 'invalid-email', password: '' },
                query: {},
                params: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            const middleware = validate(loginSchema);
            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Validation failed'
            }));
        });
    });

    describe('Custom Allocation Order & Sequential Receipts', () => {
        it('should allocate payment to principal first if customized in settings', async () => {
            const mockDues = [
                { id: 'due-1', dueSequence: 1, totalDue: 125, amountPaid: 0, penaltyDue: 5, interestDue: 20, principalDue: 100 },
            ];
            mockTx.loanDue.findMany.mockResolvedValue(mockDues);
            mockTx.loan.findUnique.mockResolvedValue({ id: 'loan-1', outstandingPrincipal: 1000 });
            mockTx.loanDue.count.mockResolvedValue(1);
            mockTx.payment.create.mockImplementation(({ data }) => Promise.resolve({ id: 'payment-1', ...data }));
            mockTx.receipt.create.mockResolvedValue({ id: 'receipt-1' });

            // Custom priority: Principal -> Interest -> Penalty
            mockTx.organization.findUnique.mockResolvedValue({
                id: 'org-1',
                name: 'QuickLoans Pvt Ltd',
                settings: {
                    allocationOrder: ['principal', 'interest', 'penalty'],
                    lastReceiptSequence: 5
                }
            });

            const result = await paymentService.recordPayment({
                orgId: 'org-1',
                loanId: 'loan-1',
                amount: 110,
                paymentMethod: 'cash',
                createdBy: 'user-1'
            });

            // Allocation: principal=100, interest=10, penalty=0 (total 110)
            expect(result.allocationDetails[0]).toEqual({
                loanDueId: 'due-1',
                dueSequence: 1,
                penalty: 0,
                interest: 10,
                principal: 100,
                total: 110,
            });

            // Sequential receipt check: RCP-QUI-000006
            expect(mockTx.receipt.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    receiptNumber: 'RCP-QUI-000006'
                })
            });
        });
    });

    describe('Payment Idempotency', () => {
        it('should bypass double recording and return cached record if duplicate key supplied', async () => {
            const existingPayment = {
                id: 'payment-existing',
                orgId: 'org-1',
                loanId: 'loan-1',
                amount: 110,
                allocationDetails: [{ loanDueId: 'due-1', total: 110 }],
                receipts: [{ id: 'receipt-existing', receiptNumber: 'RCP-QUI-000005' }]
            };

            prisma.payment.findFirst.mockResolvedValue(existingPayment);

            const result = await paymentService.recordPayment({
                orgId: 'org-1',
                loanId: 'loan-1',
                amount: 110,
                paymentMethod: 'cash',
                createdBy: 'user-1',
                idempotencyKey: 'idemp-key-1'
            });

            expect(result.isDuplicate).toBe(true);
            expect(result.payment.id).toBe('payment-existing');
            expect(prisma.payment.findFirst).toHaveBeenCalledWith({
                where: { orgId: 'org-1', idempotencyKey: 'idemp-key-1' },
                include: { receipts: true }
            });
            // Transaction-level logic should not run
            expect(mockTx.loanDue.findMany).not.toHaveBeenCalled();
        });
    });

    describe('S3 Storage Fallback', () => {
        it('should fallback to mock URL if AWS is not configured', async () => {
            const receiptService = require('../src/services/receipt.service');
            const url = await receiptService.uploadReceiptToS3('receipt-123', Buffer.from('dummy-pdf'));
            expect(url).toBe('https://s3.amazonaws.com/mock-bucket/receipts/receipt-123.pdf');
        });
    });

    describe('Twilio Webhook Handling', () => {
        it('should correctly handle and update message status', async () => {
            const mockNotification = { id: 'notif-1', providerMessageId: 'msg-123' };
            const prismaMock = require('../src/config/database');
            
            // Mock prisma.notification.findFirst and prisma.notification.update
            prismaMock.notification = {
                findFirst: jest.fn().mockResolvedValue(mockNotification),
                update: jest.fn().mockResolvedValue(mockNotification)
            };

            const { handleWebhook } = require('../src/services/notification.service');
            await handleWebhook('msg-123', 'delivered');

            expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
                where: { providerMessageId: 'msg-123' }
            });
            expect(prismaMock.notification.update).toHaveBeenCalledWith({
                where: { id: 'notif-1' },
                data: {
                    status: 'sent',
                    sentAt: expect.any(Date)
                }
            });
        });
    });

    describe('Jobs Worker Fallback', () => {
        it('should fallback to interval timers if Redis is not configured or fails', () => {
            const worker = require('../src/jobs/worker');
            // Mock startWorkers to verify it runs without crashing when Redis is down
            expect(() => worker.startWorkers()).not.toThrow();
        });

        afterAll(async () => {
            const worker = require('../src/jobs/worker');
            await worker.stopWorkers();
        });
    });
});
