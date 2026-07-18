const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
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

/**
 * Resell a repossessed/seized vehicle outright for cash.
 */
async function resellVehicle({ orgId, seizureId, salePrice, buyerName, buyerPhone, paymentMethod, userId }) {
    const result = await prisma.$transaction(async (tx) => {
        // 1. Get Seizure details
        const seizure = await tx.vehicleSeizure.findFirst({
            where: { id: seizureId, orgId }
        });
        if (!seizure) {
            throw new Error('Seizure record not found');
        }

        // 2. Update VehicleSeizure status to "sold"
        const updatedSeizure = await tx.vehicleSeizure.update({
            where: { id: seizureId, orgId },
            data: { status: 'sold' }
        });

        // 3. Update Vehicle status to "sold"
        await tx.vehicle.update({
            where: { id: seizure.vehicleId, orgId },
            data: { status: 'sold' }
        });

        // 4. Update original Loan status to "closed"
        await tx.loan.update({
            where: { id: seizure.loanId, orgId },
            data: { status: 'closed' }
        });

        return { seizure: updatedSeizure, originalLoanId: seizure.loanId };
    });

    // 5. Record the Cash Resale Payment using core payment logic (creates transaction/receipt)
    if (salePrice > 0) {
        const paymentService = require('./payment.service');
        await paymentService.recordPayment({
            orgId,
            loanId: result.originalLoanId,
            amount: salePrice,
            paymentMethod: paymentMethod || 'cash',
            referenceNumber: `Resale: ${buyerName || 'Buyer'} (${buyerPhone || 'N/A'})`,
            createdBy: userId
        });
    }

    // 6. Log audit
    await logAudit({
        orgId,
        userId,
        action: 'vehicle_resold',
        entityType: 'vehicle_seizure',
        entityId: seizureId,
        details: { salePrice, buyerName, buyerPhone, paymentMethod }
    });

    return result.seizure;
}

/**
 * Settle a vehicle seizure (Owner Redemption, Cash Sale, or Financed Sale).
 */
async function settleSeizure({ orgId, seizureId, settlementType, settlementAmount, buyerName, buyerPhone, buyerAddress, userId }) {
    const result = await prisma.$transaction(async (tx) => {
        // 1. Get Seizure details with relations
        const seizure = await tx.vehicleSeizure.findFirst({
            where: { id: seizureId, orgId },
            include: { vehicle: true, loan: true }
        });
        if (!seizure) {
            throw new Error('Seizure record not found');
        }

        // 2. Fetch all unpaid dues of the associated loan to calculate total outstanding
        const dues = await tx.loanDue.findMany({
            where: { orgId, loanId: seizure.loanId, status: { not: 'paid' } }
        });
        const totalOutstanding = dues.reduce((sum, due) => {
            return sum.plus(new Prisma.Decimal(due.totalDue).minus(due.amountPaid));
        }, new Prisma.Decimal(0));

        const lossAmount = Prisma.Decimal.max(0, totalOutstanding.minus(new Prisma.Decimal(settlementAmount || 0)));

        let buyerCustomer = null;

        // 3. Handle status/ownership changes based on type
        if (settlementType === 'redemption') {
            // Redemption: Return vehicle status to active
            await tx.vehicle.update({
                where: { id: seizure.vehicleId, orgId },
                data: { status: 'active' }
            });
        } else {
            // Cash Sale or Financed Sale: Resolve new buyer customer
            if (buyerPhone) {
                buyerCustomer = await tx.customer.findFirst({
                    where: { orgId, phone: buyerPhone }
                });
            }
            if (!buyerCustomer && buyerName) {
                buyerCustomer = await tx.customer.create({
                    data: {
                        id: uuidv4(),
                        orgId,
                        name: buyerName,
                        phone: buyerPhone || '',
                        address: buyerAddress || ''
                    }
                });
            }

            const newOwnerId = buyerCustomer ? buyerCustomer.id : seizure.vehicle.customerId;

            // Update ownership and status on Vehicle
            await tx.vehicle.update({
                where: { id: seizure.vehicleId, orgId },
                data: {
                    customerId: newOwnerId,
                    status: settlementType === 'cash_sale' ? 'sold' : 'active'
                }
            });
        }

        // 4. Close the old loan
        await tx.loan.update({
            where: { id: seizure.loanId, orgId },
            data: {
                status: 'closed',
                outstandingPrincipal: 0
            }
        });

        // Mark all unpaid dues on the old loan as paid
        await tx.loanDue.updateMany({
            where: { loanId: seizure.loanId, orgId, status: { not: 'paid' } },
            data: { status: 'paid' }
        });

        // 5. Update the VehicleSeizure status
        const updatedSeizure = await tx.vehicleSeizure.update({
            where: { id: seizureId, orgId },
            data: {
                status: settlementType === 'redemption' ? 'settled' : 'sold',
                settlementType,
                settlementAmount: new Prisma.Decimal(settlementAmount || 0),
                lossAmount,
                settledAt: new Date(),
                settledBy: settlementType === 'redemption' ? 'Original Customer' : (buyerName || 'Buyer')
            }
        });

        return { seizure: updatedSeizure, buyerCustomer, originalLoanId: seizure.loanId };
    });

    // 6. Record recovery payment under old loan using core recordPayment service (if amount > 0)
    if (settlementAmount > 0) {
        try {
            const paymentService = require('./payment.service');
            await paymentService.recordPayment({
                orgId,
                loanId: result.originalLoanId,
                amount: settlementAmount,
                paymentMethod: 'cash',
                referenceNumber: `Settlement: ${settlementType.toUpperCase()} - ${settlementType === 'redemption' ? 'Redemption' : (buyerName || 'Buyer')}`,
                createdBy: userId
            });
        } catch (paymentErr) {
            console.error('Failed to log settlement recovery payment transaction:', paymentErr);
        }
    }

    // 7. Log Audit
    await logAudit({
        orgId,
        userId,
        action: 'vehicle_seizure_settled',
        entityType: 'vehicle_seizure',
        entityId: seizureId,
        details: { settlementType, settlementAmount, lossAmount: Number(result.seizure.lossAmount), buyerName }
    });

    return { seizure: result.seizure, buyerCustomer: result.buyerCustomer };
}

module.exports = {
    seizeVehicle,
    getSeizedInventory,
    updateSeizureValuation,
    resellVehicle,
    settleSeizure
};
