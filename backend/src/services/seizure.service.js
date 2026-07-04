const prisma = require('../config/database');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Seize a vehicle associated with a loan.
 * Executes within a Prisma transaction.
 */
async function seizeVehicle({ orgId, loanId, vehicleId, userId, yardLocation, valuationAmount, notes, seizureDate }) {
    const seizureId = uuidv4();
    
    const result = await prisma.$transaction(async (tx) => {
        // 1. Update Vehicle status to "seized"
        await tx.vehicle.update({
            where: { id: vehicleId, orgId },
            data: { status: 'seized' }
        });

        // 2. Update Loan status to "seized"
        await tx.loan.update({
            where: { id: loanId, orgId },
            data: { status: 'seized' }
        });

        // 3. Create VehicleSeizure record
        const seizure = await tx.vehicleSeizure.create({
            data: {
                id: seizureId,
                orgId,
                vehicleId,
                loanId,
                seizedBy: userId,
                yardLocation,
                valuationAmount: valuationAmount ? Number(valuationAmount) : null,
                status: 'in_yard',
                notes,
                seizureDate: seizureDate ? new Date(seizureDate) : undefined
            }
        });

        return seizure;
    });

    // 4. Log audit activity
    await logAudit({
        orgId,
        userId,
        action: 'vehicle_seizure_created',
        entityType: 'vehicle_seizure',
        entityId: seizureId,
        details: { loanId, vehicleId, yardLocation, valuationAmount, seizureDate }
    });

    return result;
}

/**
 * Fetch repossessed vehicle inventory for an organization.
 * Filters vehicles with status "seized" or "sold".
 */
async function getSeizedInventory(orgId, { status } = {}) {
    const where = {
        orgId,
        status: { in: ['seized', 'sold'] }
    };

    if (status) {
        where.seizures = {
            some: {
                status: status
            }
        };
    }

    return prisma.vehicle.findMany({
        where,
        include: {
            customer: {
                select: {
                    id: true,
                    name: true,
                    phone: true
                }
            },
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
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Update the valuation amount of a vehicle seizure.
 */
async function updateSeizureValuation({ orgId, seizureId, valuationAmount }) {
    return prisma.vehicleSeizure.update({
        where: { id: seizureId, orgId },
        data: {
            valuationAmount: valuationAmount ? Number(valuationAmount) : null
        }
    });
}

module.exports = {
    seizeVehicle,
    getSeizedInventory,
    updateSeizureValuation
};
