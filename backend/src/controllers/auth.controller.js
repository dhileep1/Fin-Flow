const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

async function login(req, res, next) {
    try {
        const { email, phone, password } = req.body;

        if (!password || (!email && !phone)) {
            return res.status(400).json({ error: 'Email/phone and password are required' });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim().toLowerCase() } : undefined,
                    phone ? { phone: phone.trim() } : undefined,
                ].filter(Boolean),
            },
            include: { org: true }
        });

        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        if (user.org && user.org.status !== 'active') {
            return res.status(403).json({ error: 'Organization is inactive' });
        }

        const token = jwt.sign(
            { id: user.id, orgId: user.orgId, role: user.role, name: user.name },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role, orgId: user.orgId },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Forgot Password: Request Email/Phone OTP
 */
async function requestOtp(req, res, next) {
    try {
        const { email, phone } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim().toLowerCase() } : undefined,
                    phone ? { phone: phone.trim() } : undefined,
                ].filter(Boolean),
            },
        });

        if (!user) {
            // Return success message to prevent account enumeration
            return res.json({ message: 'If an account matches those details, an OTP has been sent.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetOtp: otp,
                resetOtpExpiresAt: expiresAt,
            },
        });

        logger.info(`[Auth] OTP for user ${user.id} (${user.email || user.phone}): ${otp}`);

        res.json({
            message: 'OTP sent successfully',
            devOtp: config.nodeEnv === 'development' ? otp : undefined,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Forgot Password: Verify OTP and Reset Password
 */
async function verifyOtpAndResetPassword(req, res, next) {
    try {
        const { email, phone, otp, newPassword } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim().toLowerCase() } : undefined,
                    phone ? { phone: phone.trim() } : undefined,
                ].filter(Boolean),
            },
        });

        if (!user || !user.resetOtp || !user.resetOtpExpiresAt) {
            return res.status(400).json({ error: 'Invalid or expired OTP request' });
        }

        if (user.resetOtp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (new Date() > new Date(user.resetOtpExpiresAt)) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetOtp: null,
                resetOtpExpiresAt: null,
                resetApprovedBySuperAdmin: false,
            },
        });

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Forgot Password: Request SuperAdmin Permission / Approval
 */
async function requestSuperAdminReset(req, res, next) {
    try {
        const { email, phone, reason } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim().toLowerCase() } : undefined,
                    phone ? { phone: phone.trim() } : undefined,
                ].filter(Boolean),
            },
            include: { org: true }
        });

        if (!user) {
            return res.json({ message: 'If an account matches those details, your reset request has been sent to SuperAdmin.' });
        }

        // Create SuperAdmin Audit Log entry for the request
        await prisma.superAdminAuditLog.create({
            data: {
                superAdminId: (await prisma.superAdminUser.findFirst())?.id || user.id, // reference super admin user if exists
                targetOrgId: user.orgId,
                action: 'PASSWORD_RESET_REQUESTED',
                reason: reason || 'User requested password reset via SuperAdmin approval',
                details: { userId: user.id, userEmail: user.email, userPhone: user.phone },
            },
        }).catch(() => {
            // non-fatal log fallback
        });

        res.json({
            message: 'Your password reset request has been submitted to SuperAdmin. Please contact your administrator for approval.',
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Forgot Password: Set New Password after SuperAdmin approval
 */
async function resetWithSuperAdminPermission(req, res, next) {
    try {
        const { email, phone, newPassword } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim().toLowerCase() } : undefined,
                    phone ? { phone: phone.trim() } : undefined,
                ].filter(Boolean),
            },
        });

        if (!user || !user.resetApprovedBySuperAdmin) {
            return res.status(403).json({ error: 'SuperAdmin permission is required or not yet granted' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetApprovedBySuperAdmin: false,
            },
        });

        res.json({ message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    requestOtp,
    verifyOtpAndResetPassword,
    requestSuperAdminReset,
    resetWithSuperAdminPermission,
};
