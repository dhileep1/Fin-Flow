const prisma = require('../config/database');
const { logAudit } = require('../services/audit.service');

async function listVehicles(req, res, next) {
    try {
        const { customerId, q, limit = 25, page = 1 } = req.query;
        const where = { orgId: req.orgId };
        if (customerId) where.customerId = customerId;
        if (q) {
            where.OR = [
                { vehicleNumber: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany({
                where,
                include: { 
                    customer: { select: { id: true, name: true, phone: true } },
                    seizures: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    loans: {
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.vehicle.count({ where }),
        ]);

        res.json({ vehicles, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        next(err);
    }
}

async function createVehicle(req, res, next) {
    try {
        const { customerId, vehicleNumber, model, engineNumber, chassisNumber, rcImageUrl, insuranceValidTill } = req.body;
        if (!customerId || !vehicleNumber) {
            return res.status(400).json({ error: 'Customer ID and vehicle number are required' });
        }

        const vehicle = await prisma.vehicle.create({
            data: {
                orgId: req.orgId,
                customerId,
                vehicleNumber,
                model,
                engineNumber,
                chassisNumber,
                rcImageUrl,
                insuranceValidTill: insuranceValidTill ? new Date(insuranceValidTill) : null,
            },
        });

        await logAudit({
            orgId: req.orgId, userId: req.user.id,
            action: 'vehicle_created', entityType: 'vehicle', entityId: vehicle.id,
        });

        res.status(201).json(vehicle);
    } catch (err) {
        next(err);
    }
}

async function updateVehicle(req, res, next) {
    try {
        const { vehicleNumber, model, engineNumber, chassisNumber, rcImageUrl, insuranceValidTill } = req.body;
        const vehicle = await prisma.vehicle.updateMany({
            where: { id: req.params.id, orgId: req.orgId },
            data: { vehicleNumber, model, engineNumber, chassisNumber, rcImageUrl, insuranceValidTill: insuranceValidTill ? new Date(insuranceValidTill) : undefined },
        });
        if (vehicle.count === 0) return res.status(404).json({ error: 'Vehicle not found' });

        const updated = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

async function getVehicleById(req, res, next) {
    try {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id: req.params.id, orgId: req.orgId },
            include: {
                customer: { select: { id: true, name: true, phone: true, address: true } },
                loans: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        customer: { select: { id: true, name: true, phone: true } },
                        payments: { select: { amount: true } }
                    }
                },
                seizures: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: { select: { name: true } }
                    }
                },
                vehicleSales: {
                    orderBy: { createdAt: 'desc' }
                },
                expenses: {
                    orderBy: { expenseDate: 'desc' },
                    include: {
                        creator: { select: { name: true } }
                    }
                }
            }
        });

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (err) {
        next(err);
    }
}

module.exports = { listVehicles, createVehicle, updateVehicle, getVehicleById };
