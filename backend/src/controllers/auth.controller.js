const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

async function login(req, res, next) {
    try {
        const { email, phone, password } = req.body;
        const orgId = req.params.orgId;

        if (!password || (!email && !phone)) {
            return res.status(400).json({ error: 'Email/phone and password are required' });
        }

        const where = { orgId };
        if (email) where.email = email;
        else where.phone = phone;

        const user = await prisma.user.findFirst({ where });
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

module.exports = { login };
