const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

// --- Organization settings ---
router.get('/settings', requireRole('admin'), async (req, res, next) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.orgId } });
        res.json(org);
    } catch (err) { next(err); }
});

router.put('/settings', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, address, settings } = req.body;
        const org = await prisma.organization.update({
            where: { id: req.orgId },
            data: { name, phone, address, settings },
        });
        res.json(org);
    } catch (err) { next(err); }
});

// --- User management ---
router.get('/users', requireRole('admin'), async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { orgId: req.orgId },
            select: { id: true, name: true, phone: true, email: true, role: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) { next(err); }
});

router.post('/users', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, email, password, role } = req.body;
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { orgId: req.orgId, name, phone, email, passwordHash, role },
        });
        res.status(201).json({ id: user.id, name: user.name, role: user.role });
    } catch (err) { next(err); }
});

router.put('/users/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const { name, phone, email, role, status, password } = req.body;
        const data = { name, phone, email, role, status };
        if (password) data.passwordHash = await bcrypt.hash(password, 12);
        await prisma.user.updateMany({
            where: { id: req.params.id, orgId: req.orgId },
            data,
        });
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        res.json({ id: user.id, name: user.name, role: user.role, status: user.status });
    } catch (err) { next(err); }
});

module.exports = router;
