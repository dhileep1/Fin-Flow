const prisma = require('../config/database');
const { logAudit } = require('../services/audit.service');

async function listCustomers(req, res, next) {
    try {
        const { q, limit = 25, page = 1 } = req.query;
        const where = { orgId: req.orgId };

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                include: {
                    vehicles: { select: { id: true, vehicleNumber: true, model: true } },
                    loans: {
                        select: {
                            id: true,
                            status: true,
                            nextDueDate: true,
                            outstandingPrincipal: true,
                            payments: {
                                orderBy: { paymentDate: 'desc' },
                                take: 1,
                                select: { paymentDate: true }
                            }
                        }
                    },
                    _count: { select: { loans: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.customer.count({ where }),
        ]);

        res.json({ customers, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        next(err);
    }
}

async function getCustomer(req, res, next) {
    try {
        const customer = await prisma.customer.findFirst({
            where: { id: req.params.id, orgId: req.orgId },
            include: {
                vehicles: true,
                loans: {
                    include: {
                        vehicle: { select: { vehicleNumber: true, model: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        next(err);
    }
}

async function createCustomer(req, res, next) {
    try {
        const { name, phone, altPhone, address, aadharNumber, photoUrl } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        const customer = await prisma.customer.create({
            data: {
                orgId: req.orgId,
                name,
                phone,
                altPhone: altPhone || [],
                address,
                aadharNumber,
                photoUrl,
            },
        });

        await logAudit({
            orgId: req.orgId, userId: req.user.id,
            action: 'customer_created', entityType: 'customer', entityId: customer.id,
        });

        res.status(201).json(customer);
    } catch (err) {
        next(err);
    }
}

async function updateCustomer(req, res, next) {
    try {
        const { name, phone, altPhone, address, aadharNumber, photoUrl, optOutWhatsapp } = req.body;
        const customer = await prisma.customer.updateMany({
            where: { id: req.params.id, orgId: req.orgId },
            data: { name, phone, altPhone, address, aadharNumber, photoUrl, optOutWhatsapp },
        });
        if (customer.count === 0) return res.status(404).json({ error: 'Customer not found' });

        await logAudit({
            orgId: req.orgId, userId: req.user.id,
            action: 'customer_updated', entityType: 'customer', entityId: req.params.id,
        });

        const updated = await prisma.customer.findUnique({ where: { id: req.params.id } });
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer };
