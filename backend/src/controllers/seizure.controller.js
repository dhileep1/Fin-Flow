const seizureService = require('../services/seizure.service');

async function seizeVehicle(req, res, next) {
    try {
        const { loanId, vehicleId, yardLocation, notes, seizureDate } = req.body;
        
        if (!loanId || !vehicleId) {
            return res.status(400).json({ error: 'Loan ID and Vehicle ID are required' });
        }

        const seizure = await seizureService.seizeVehicle({
            orgId: req.orgId,
            loanId,
            vehicleId,
            userId: req.user.id,
            yardLocation,
            notes,
            seizureDate
        });

        res.status(201).json(seizure);
    } catch (err) {
        next(err);
    }
}

async function getSeizedInventory(req, res, next) {
    try {
        const { status, page, limit } = req.query;
        const inventory = await seizureService.getSeizedInventory(req.orgId, { status, page, limit });
        res.json(inventory);
    } catch (err) {
        next(err);
    }
}




async function settleSeizure(req, res, next) {
    try {
        const { id } = req.params;
        const {
            settlementType,
            settlementAmount,
            downPayment,
            buyerName,
            buyerPhone,
            buyerAddress,
            buyerCustomerId,
            resalePrice,
            principalAmount,
            tenureMonths,
            monthlyInterestRate,
            startDate,
            guarantors,
            paymentMethod
        } = req.body;
        
        const result = await seizureService.settleSeizure({
            orgId: req.orgId,
            seizureId: id,
            settlementType,
            settlementAmount,
            downPayment,
            buyerName,
            buyerPhone,
            buyerAddress,
            buyerCustomerId,
            resalePrice,
            principalAmount,
            tenureMonths,
            monthlyInterestRate,
            startDate,
            guarantors,
            paymentMethod,
            userId: req.user.id
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function getVehicleSales(req, res, next) {
    try {
        const { page, limit } = req.query;
        const sales = await seizureService.getVehicleSales(req.orgId, { page, limit });
        res.json(sales);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    seizeVehicle,
    getSeizedInventory,
    settleSeizure,
    getVehicleSales
};
