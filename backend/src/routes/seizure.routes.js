const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { seizeVehicle, getSeizedInventory, updateSeizureValuation } = require('../controllers/seizure.controller');

const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.post('/', seizeVehicle);
router.get('/inventory', getSeizedInventory);
router.put('/:id/valuation', updateSeizureValuation);

module.exports = router;
