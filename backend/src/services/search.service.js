const prisma = require('../config/database');

/**
 * Unified search across customers, vehicles, and loans.
 * Searches by name, phone, vehicle number, and loan ID.
 */
async function search(orgId, query, { limit = 25, type } = {}) {
    if (!query || query.trim().length < 2) {
        return { customers: [], vehicles: [], loans: [] };
    }

    const q = query.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(q);

    let customers = [];
    let vehicles = [];
    let loans = [];

    // Search customers
    if (!type || type === 'name' || type === 'phone') {
        customers = await prisma.customer.findMany({
            where: {
                orgId,
                OR: [
                    ...((!type || type === 'name') ? [{ name: { contains: q, mode: 'insensitive' } }] : []),
                    ...((!type || type === 'phone') ? [{ phone: { contains: q } }] : []),
                ],
            },
            take: limit,
            orderBy: { name: 'asc' },
        });
    }

    // Search vehicles
    if (!type || type === 'vehicle') {
        vehicles = await prisma.vehicle.findMany({
            where: {
                orgId,
                OR: [
                    { vehicleNumber: { contains: q, mode: 'insensitive' } },
                    ...(!type ? [{ model: { contains: q, mode: 'insensitive' } }] : []),
                ],
            },
            include: {
                customer: { select: { name: true, phone: true } },
            },
            take: limit,
            orderBy: { vehicleNumber: 'asc' },
        });
    }

    // Search loans
    loans = await prisma.loan.findMany({
        where: {
            orgId,
            OR: [
                ...(isUuid ? [{ id: q }] : []),
                ...((!type || type === 'name') ? [{ customer: { name: { contains: q, mode: 'insensitive' } } }] : []),
                ...((!type || type === 'phone') ? [{ customer: { phone: { contains: q } } }] : []),
                ...((!type || type === 'vehicle') ? [{ vehicle: { vehicleNumber: { contains: q, mode: 'insensitive' } } }] : []),
            ],
        },
        include: {
            customer: { select: { id: true, name: true, phone: true } },
            vehicle: { select: { id: true, vehicleNumber: true, model: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
    });

    return { customers, vehicles, loans };
}

module.exports = { search };
