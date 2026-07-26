const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Super-Admin login.
 * Authenticates against the SuperAdminUser table and issues a JWT
 * with { isSuperAdmin: true, role } to distinguish from tenant tokens.
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await prisma.superAdminUser.findUnique({
            where: { email: email.trim().toLowerCase() },
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                isSuperAdmin: true,
                role: user.role,
                name: user.name,
            },
            config.jwtSecret,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { login };
