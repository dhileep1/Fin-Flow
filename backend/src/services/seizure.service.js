const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const { logAudit } = require('./audit.service');
const { v4: uuidv4 } = require('uuid');
const { generateSchedule } = require('./loan.service');
const { addMonths } = require('../utils/dateUtils');

/**
 * Seize a vehicle associated with a loan.
 * Executes within a Prisma transaction.
 */
async function seizeVehicle({ orgId, loanId, vehicleId, userId, yardLocation, notes, seizureDate }) {
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
        details: { loanId, vehicleId, yardLocation, seizureDate }
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
 * Helper: Calculate total payments collected for a loan.
 */
async function getTotalPaymentsCollected(tx, orgId, loanId) {
    const result = await tx.payment.aggregate({
        where: { orgId, loanId },
        _sum: { amount: true }
    });
    return new Prisma.Decimal(result._sum.amount || 0);
}

/**
 * Helper: Resolve or create a buyer customer.
 */
async function resolveOrCreateBuyer(tx, orgId, buyerName, buyerPhone, buyerAddress) {
    let buyerCustomer = null;
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
    return buyerCustomer;
}

/**
 * Settle a vehicle seizure. Three paths:
 * 
 * 1. "redemption" — Owner reclaims. Payment recorded against old loan, vehicle → active, loan → active.
 * 2. "cash_sale" — Sell outright. VehicleSale created, old loan → written_off, vehicle → sold.
 * 3. "financed_sale" — Sell with financing. Down payment as VehicleSale, old loan → written_off,
 *                       vehicle → active with new owner, frontend redirects to New Loan wizard.
 */
async function settleSeizure({
    orgId, seizureId, settlementType,
    settlementAmount, downPayment,
    buyerName, buyerPhone, buyerAddress, buyerCustomerId,
    resalePrice, principalAmount, tenureMonths, monthlyInterestRate, startDate, guarantors,
    paymentMethod, userId
}) {
    // ──────────────────────────────────────────────
    // PATH 1: RECLAIM (Owner Redemption)
    // ──────────────────────────────────────────────
    if (settlementType === 'reclaim') {
        const result = await prisma.$transaction(async (tx) => {
            const seizure = await tx.vehicleSeizure.findFirst({
                where: { id: seizureId, orgId },
                include: { vehicle: true, loan: true }
            });
            if (!seizure) throw new Error('Seizure record not found');

            // Vehicle → active
            await tx.vehicle.update({
                where: { id: seizure.vehicleId, orgId },
                data: { status: 'active' }
            });

            // Loan → active (resumes normal schedule)
            await tx.loan.update({
                where: { id: seizure.loanId, orgId },
                data: { status: 'active' }
            });

            // Seizure → settled
            const updatedSeizure = await tx.vehicleSeizure.update({
                where: { id: seizureId, orgId },
                data: {
                    status: 'settled',
                    settlementType: 'reclaim',
                    settlementAmount: new Prisma.Decimal(settlementAmount || 0),
                    settledAt: new Date(),
                    settledBy: 'Original Customer'
                }
            });

            // Record payment against old loan inside transaction context
            if (settlementAmount > 0) {
                const paymentService = require('./payment.service');
                await paymentService.recordPayment({
                    orgId,
                    loanId: seizure.loanId,
                    amount: settlementAmount,
                    paymentMethod: paymentMethod || 'cash',
                    referenceNumber: `Reclaim: Vehicle reclaimed by owner`,
                    createdBy: userId,
                    tx
                });
            }

            return { seizure: updatedSeizure, loanId: seizure.loanId };
        });

        await logAudit({
            orgId, userId,
            action: 'vehicle_seizure_settled',
            entityType: 'vehicle_seizure',
            entityId: seizureId,
            details: { settlementType: 'reclaim', settlementAmount }
        });

        return { seizure: result.seizure };
    }

    // ──────────────────────────────────────────────
    // PATH 2: SELL (Outright Cash Sale)
    // ──────────────────────────────────────────────
    if (settlementType === 'sell') {
        const saleAmount = Number(settlementAmount || 0);

        const result = await prisma.$transaction(async (tx) => {
            const seizure = await tx.vehicleSeizure.findFirst({
                where: { id: seizureId, orgId },
                include: { vehicle: true, loan: true }
            });
            if (!seizure) throw new Error('Seizure record not found');

            // Resolve buyer
            let buyerCustomer = null;
            if (buyerCustomerId) {
                buyerCustomer = await tx.customer.findFirst({ where: { id: buyerCustomerId, orgId } });
            }
            if (!buyerCustomer) {
                buyerCustomer = await resolveOrCreateBuyer(tx, orgId, buyerName, buyerPhone, buyerAddress);
            }
            const newOwnerId = buyerCustomer ? buyerCustomer.id : seizure.vehicle.customerId;

            // Calculate loss: disbursed - total payments collected - sale amount
            const totalCollected = await getTotalPaymentsCollected(tx, orgId, seizure.loanId);
            const disbursed = new Prisma.Decimal(seizure.loan.disbursedAmount || seizure.loan.principalAmount);
            const lossAmount = Prisma.Decimal.max(
                new Prisma.Decimal(0),
                disbursed.minus(totalCollected).minus(new Prisma.Decimal(saleAmount))
            );

            // Create VehicleSale record (inflow)
            const vehicleSale = await tx.vehicleSale.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    seizureId,
                    vehicleId: seizure.vehicleId,
                    loanId: seizure.loanId,
                    saleAmount: new Prisma.Decimal(saleAmount),
                    saleType: 'sell',
                    buyerName: buyerCustomer?.name || buyerName,
                    buyerPhone: buyerCustomer?.phone || buyerPhone,
                    buyerCustomerId: buyerCustomer?.id || null,
                    paymentMethod: paymentMethod || 'cash',
                    createdBy: userId
                }
            });

            // Vehicle → sold, transfer ownership
            await tx.vehicle.update({
                where: { id: seizure.vehicleId, orgId },
                data: { status: 'sold', customerId: newOwnerId }
            });

            // Old Loan → written_off (dues stay untouched)
            await tx.loan.update({
                where: { id: seizure.loanId, orgId },
                data: { status: 'written_off' }
            });

            // Seizure → sold
            const updatedSeizure = await tx.vehicleSeizure.update({
                where: { id: seizureId, orgId },
                data: {
                    status: 'sold',
                    settlementType: 'sell',
                    settlementAmount: new Prisma.Decimal(saleAmount),
                    lossAmount,
                    settledAt: new Date(),
                    settledBy: buyerCustomer?.name || buyerName || 'Buyer',
                    buyerName: buyerCustomer?.name || buyerName,
                    buyerPhone: buyerCustomer?.phone || buyerPhone,
                    buyerCustomerId: buyerCustomer?.id || null
                }
            });

            // Create settled loan record for buyer to maintain explicit purchase history
            let createdLoan = null;
            if (buyerCustomer && saleAmount > 0) {
                const P = new Prisma.Decimal(saleAmount);
                const newLoanId = uuidv4();
                const now = new Date();

                createdLoan = await tx.loan.create({
                    data: {
                        id: newLoanId,
                        orgId,
                        customerId: buyerCustomer.id,
                        vehicleId: seizure.vehicleId,
                        assignedStaffId: userId,
                        principalAmount: P,
                        tenureMonths: 1,
                        monthlyInterestRate: new Prisma.Decimal(0),
                        monthlyInterestAmount: new Prisma.Decimal(0),
                        monthlyPrincipalAmount: P,
                        monthlyDueAmount: P,
                        startDate: now,
                        nextDueDate: now,
                        outstandingPrincipal: new Prisma.Decimal(0),
                        accruedPenalty: new Prisma.Decimal(0),
                        documentFee: new Prisma.Decimal(0),
                        disbursedAmount: P,
                        status: 'settled',
                    }
                });

                await tx.loanDue.create({
                    data: {
                        id: uuidv4(),
                        orgId,
                        loanId: newLoanId,
                        dueSequence: 1,
                        dueDate: now,
                        principalDue: P,
                        interestDue: new Prisma.Decimal(0),
                        penaltyDue: new Prisma.Decimal(0),
                        amountPaid: P,
                        totalDue: P,
                        status: 'paid',
                    }
                });

                await tx.payment.create({
                    data: {
                        id: uuidv4(),
                        orgId,
                        loanId: newLoanId,
                        customerId: buyerCustomer.id,
                        amount: P,
                        paymentMethod: paymentMethod || 'cash',
                        referenceNumber: `Outright Purchase - Vehicle ${seizure.vehicle.vehicleNumber || ''}`,
                        paymentDate: now,
                        createdBy: userId
                    }
                });
            }

            return { seizure: updatedSeizure, vehicleSale, buyerCustomer, loan: createdLoan };
        });

        await logAudit({
            orgId, userId,
            action: 'vehicle_seizure_settled',
            entityType: 'vehicle_seizure',
            entityId: seizureId,
            details: { settlementType: 'sell', saleAmount, buyerName, lossAmount: Number(result.seizure.lossAmount) }
        });

        return result;
    }

    // ──────────────────────────────────────────────
    // PATH 3: FINANCE (Financed Sale)
    // ──────────────────────────────────────────────
    if (settlementType === 'sell_with_finance') {
        const dpAmount = Number(downPayment || 0);
        const resaleVal = Number(resalePrice || 0);
        const pAmount = principalAmount ? Number(principalAmount) : Math.max(0, resaleVal - dpAmount);
        const tenure = Number(tenureMonths || 12);
        const rate = Number(monthlyInterestRate || 0.02);
        const startD = startDate ? new Date(startDate) : new Date();

        const result = await prisma.$transaction(async (tx) => {
            const seizure = await tx.vehicleSeizure.findFirst({
                where: { id: seizureId, orgId },
                include: { vehicle: true, loan: true }
            });
            if (!seizure) throw new Error('Seizure record not found');

            // Resolve buyer
            let buyerCustomer = null;
            if (buyerCustomerId) {
                buyerCustomer = await tx.customer.findFirst({ where: { id: buyerCustomerId, orgId } });
            }
            if (!buyerCustomer) {
                buyerCustomer = await resolveOrCreateBuyer(tx, orgId, buyerName, buyerPhone, buyerAddress);
            }
            if (!buyerCustomer) throw new Error('Buyer details are required for financed sale');

            // Calculate loss: disbursed - total payments collected - down payment
            const totalCollected = await getTotalPaymentsCollected(tx, orgId, seizure.loanId);
            const disbursed = new Prisma.Decimal(seizure.loan.disbursedAmount || seizure.loan.principalAmount);
            const lossAmount = Prisma.Decimal.max(
                new Prisma.Decimal(0),
                disbursed.minus(totalCollected).minus(new Prisma.Decimal(dpAmount))
            );

            // Create VehicleSale record for down payment (inflow)
            let vehicleSale = null;
            if (dpAmount > 0) {
                vehicleSale = await tx.vehicleSale.create({
                    data: {
                        id: uuidv4(),
                        orgId,
                        seizureId,
                        vehicleId: seizure.vehicleId,
                        loanId: seizure.loanId,
                        saleAmount: new Prisma.Decimal(dpAmount),
                        saleType: 'sell_with_finance',
                        buyerName: buyerCustomer.name,
                        buyerPhone: buyerCustomer.phone,
                        buyerCustomerId: buyerCustomer.id,
                        paymentMethod: paymentMethod || 'cash',
                        createdBy: userId
                    }
                });
            }

            // Vehicle → active, transfer ownership to buyer
            await tx.vehicle.update({
                where: { id: seizure.vehicleId, orgId },
                data: { status: 'active', customerId: buyerCustomer.id }
            });

            // Old Loan → written_off (dues stay untouched)
            await tx.loan.update({
                where: { id: seizure.loanId, orgId },
                data: { status: 'written_off' }
            });

            // Seizure → sold
            const updatedSeizure = await tx.vehicleSeizure.update({
                where: { id: seizureId, orgId },
                data: {
                    status: 'sold',
                    settlementType: 'sell_with_finance',
                    settlementAmount: new Prisma.Decimal(dpAmount),
                    lossAmount,
                    settledAt: new Date(),
                    settledBy: buyerCustomer.name || 'Buyer',
                    buyerName: buyerCustomer.name,
                    buyerPhone: buyerCustomer.phone,
                    buyerCustomerId: buyerCustomer.id
                }
            });

            // Create New Loan for the buyer atomically!
            const P = new Prisma.Decimal(pAmount);
            const r = new Prisma.Decimal(rate);
            const N = tenure;

            const org = await tx.organization.findUnique({ where: { id: orgId } });
            const settings = org?.settings || {};
            const docFeePercent = new Prisma.Decimal(settings.documentFeePercent !== undefined ? settings.documentFeePercent : 0.05);
            const documentFee = new Prisma.Decimal(P.times(docFeePercent).toFixed(2));
            const newDisbursed = P.minus(documentFee);

            const { monthlyPrincipal, monthlyInterest, dues } = generateSchedule(P, N, r, startD);
            const monthlyDueAmount = monthlyPrincipal.plus(monthlyInterest);
            const firstDueDate = addMonths(new Date(startD), 1);
            const newLoanId = uuidv4();

            const createdLoan = await tx.loan.create({
                data: {
                    id: newLoanId,
                    orgId,
                    customerId: buyerCustomer.id,
                    vehicleId: seizure.vehicleId,
                    assignedStaffId: userId,
                    principalAmount: P,
                    tenureMonths: N,
                    monthlyInterestRate: r,
                    monthlyInterestAmount: monthlyInterest,
                    monthlyPrincipalAmount: monthlyPrincipal,
                    monthlyDueAmount,
                    startDate: new Date(startD),
                    nextDueDate: firstDueDate,
                    outstandingPrincipal: P,
                    accruedPenalty: new Prisma.Decimal(0),
                    documentFee,
                    disbursedAmount: newDisbursed,
                    status: 'active',
                }
            });

            const loanDuesData = dues.map((due) => ({
                id: uuidv4(),
                orgId,
                loanId: newLoanId,
                dueSequence: due.dueSequence,
                dueDate: due.dueDate,
                principalDue: due.principalDue,
                interestDue: due.interestDue,
                penaltyDue: due.penaltyDue,
                amountPaid: due.amountPaid,
                totalDue: due.totalDue,
                status: due.status,
            }));
            await tx.loanDue.createMany({ data: loanDuesData });

            await tx.callTask.create({
                data: {
                    id: uuidv4(),
                    orgId,
                    loanId: newLoanId,
                    assignedStaffId: userId,
                    nextCallDate: firstDueDate,
                }
            });

            // Process guarantors
            if (guarantors && Array.isArray(guarantors)) {
                for (const g of guarantors) {
                    if (g && g.name && g.name.trim()) {
                        let gCustId = g.customerId;
                        if (!gCustId && g.phone) {
                            const existingG = await tx.customer.findFirst({
                                where: { orgId, phone: g.phone }
                            });
                            if (existingG) {
                                gCustId = existingG.id;
                            } else {
                                const newGCust = await tx.customer.create({
                                    data: {
                                        id: uuidv4(),
                                        orgId,
                                        name: g.name.trim(),
                                        phone: g.phone || '',
                                        address: g.address || ''
                                    }
                                });
                                gCustId = newGCust.id;
                            }
                        }
                        await tx.guarantor.create({
                            data: {
                                id: uuidv4(),
                                orgId,
                                loanId: newLoanId,
                                customerId: gCustId || null,
                                name: g.name.trim(),
                                phone: g.phone || null,
                                aadharNumber: g.aadharNumber || null,
                                address: g.address || null
                            }
                        });
                    }
                }
            }

            return { seizure: updatedSeizure, vehicleSale, buyerCustomer, loan: createdLoan };
        });

        await logAudit({
            orgId, userId,
            action: 'vehicle_seizure_settled',
            entityType: 'vehicle_seizure',
            entityId: seizureId,
            details: { settlementType: 'sell_with_finance', downPayment: dpAmount, buyerName: result.buyerCustomer.name, lossAmount: Number(result.seizure.lossAmount) }
        });

        return result;
    }

    throw new Error(`Invalid settlement type: ${settlementType}. Must be 'reclaim', 'sell', or 'sell_with_finance'.`);
}

/**
 * Get all vehicle sales for an organization (for the Transactions page).
 */
async function getVehicleSales(orgId) {
    return prisma.vehicleSale.findMany({
        where: { orgId },
        include: {
            vehicle: { select: { id: true, vehicleNumber: true, model: true } },
            loan: { select: { id: true, principalAmount: true } },
            seizure: { select: { id: true, seizureDate: true } },
            creator: { select: { id: true, name: true } }
        },
        orderBy: { saleDate: 'desc' }
    });
}

module.exports = {
    seizeVehicle,
    getSeizedInventory,
    settleSeizure,
    getVehicleSales
};
