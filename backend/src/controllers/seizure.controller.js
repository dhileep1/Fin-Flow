const seizureService = require('../services/seizure.service');

async function seizeVehicle(req, res, next) {
    try {
        const { loanId, vehicleId, yardLocation, valuationAmount, notes, seizureDate } = req.body;
        
        if (!loanId || !vehicleId) {
            return res.status(400).json({ error: 'Loan ID and Vehicle ID are required' });
        }

        const seizure = await seizureService.seizeVehicle({
            orgId: req.orgId,
            loanId,
            vehicleId,
            userId: req.user.id,
            yardLocation,
            valuationAmount,
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
        const { status } = req.query;
        const inventory = await seizureService.getSeizedInventory(req.orgId, { status });
        res.json(inventory);
    } catch (err) {
        next(err);
    }
}

async function updateSeizureValuation(req, res, next) {
    try {
        const { id } = req.params;
        const { valuationAmount } = req.body;
        
        const seizure = await seizureService.updateSeizureValuation({
            orgId: req.orgId,
            seizureId: id,
            valuationAmount
        });

        res.json(seizure);
    } catch (err) {
        next(err);
    }
}

async function resellVehicle(req, res, next) {
    try {
        const { id } = req.params;
        const { salePrice, buyerName, buyerPhone, paymentMethod } = req.body;
        
        const seizure = await seizureService.resellVehicle({
            orgId: req.orgId,
            seizureId: id,
            salePrice,
            buyerName,
            buyerPhone,
            paymentMethod,
            userId: req.user.id
        });

        res.json(seizure);
    } catch (err) {
        next(err);
    }
}

async function settleSeizure(req, res, next) {
    try {
        const { id } = req.params;
        const { settlementType, settlementAmount, buyerName, buyerPhone, buyerAddress } = req.body;
        
        const result = await seizureService.settleSeizure({
            orgId: req.orgId,
            seizureId: id,
            settlementType,
            settlementAmount,
            buyerName,
            buyerPhone,
            buyerAddress,
            userId: req.user.id
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    seizeVehicle,
    getSeizedInventory,
    updateSeizureValuation,
    resellVehicle,
    settleSeizure
};
