const prisma = require('../src/config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { login, requestOtp, verifyOtpAndResetPassword } = require('../src/controllers/auth.controller');

jest.mock('../src/config/database', () => ({
    user: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    superAdminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
    superAdminUser: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sa-1' }),
    },
}));

describe('Auth Controller (Global Authentication & Forgot Password)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Global Login', () => {
        it('should successfully log in user without orgId in params and return orgId in metadata', async () => {
            const mockPasswordHash = await bcrypt.hash('secret123', 10);
            const mockUser = {
                id: 'user-123',
                orgId: 'org-456',
                name: 'John Doe',
                email: 'john@example.com',
                passwordHash: mockPasswordHash,
                role: 'admin',
                status: 'active',
                org: { id: 'org-456', status: 'active' },
            };

            prisma.user.findFirst.mockResolvedValue(mockUser);

            const req = {
                body: { email: 'JOHN@EXAMPLE.COM', password: 'secret123' },
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await login(req, res, next);

            expect(prisma.user.findFirst).toHaveBeenCalledWith({
                where: {
                    OR: [{ email: 'john@example.com' }],
                },
                include: { org: true },
            });

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: expect.any(String),
                    user: expect.objectContaining({
                        id: 'user-123',
                        orgId: 'org-456',
                        name: 'John Doe',
                    }),
                })
            );
        });

        it('should reject login if password does not match', async () => {
            const mockPasswordHash = await bcrypt.hash('secret123', 10);
            const mockUser = {
                id: 'user-123',
                passwordHash: mockPasswordHash,
                status: 'active',
            };

            prisma.user.findFirst.mockResolvedValue(mockUser);

            const req = {
                body: { email: 'john@example.com', password: 'wrongpassword' },
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            await login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
        });
    });

    describe('Forgot Password (OTP)', () => {
        it('should generate OTP and save to user model', async () => {
            const mockUser = { id: 'user-123', email: 'john@example.com' };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, resetOtp: '123456' });

            const req = { body: { email: 'john@example.com' } };
            const res = { json: jest.fn() };
            const next = jest.fn();

            await requestOtp(req, res, next);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: {
                    resetOtp: expect.stringMatching(/^\d{6}$/),
                    resetOtpExpiresAt: expect.any(Date),
                },
            });
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'OTP sent successfully',
                })
            );
        });

        it('should verify OTP and reset user password', async () => {
            const mockUser = {
                id: 'user-123',
                resetOtp: '654321',
                resetOtpExpiresAt: new Date(Date.now() + 1000 * 60 * 10), // valid for 10 mins
            };
            prisma.user.findFirst.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, resetOtp: null });

            const req = {
                body: {
                    email: 'john@example.com',
                    otp: '654321',
                    newPassword: 'newPassword123',
                },
            };
            const res = { json: jest.fn() };
            const next = jest.fn();

            await verifyOtpAndResetPassword(req, res, next);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: expect.objectContaining({
                    resetOtp: null,
                    resetOtpExpiresAt: null,
                }),
            });
            expect(res.json).toHaveBeenCalledWith({
                message: 'Password reset successfully. You can now log in.',
            });
        });
    });
});
