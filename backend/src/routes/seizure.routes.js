const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { seizeVehicleSchema, settleSeizureSchema } = require('../utils/validation.schemas');
const { seizeVehicle, getSeizedInventory, settleSeizure, getVehicleSales } = require('../controllers/seizure.controller');

const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.post('/', requireRole('admin', 'accountant'), validate(seizeVehicleSchema), seizeVehicle);
router.get('/inventory', getSeizedInventory);
router.get('/sales', getVehicleSales);

// MOD-5: Added validation middleware for settlement body
router.post('/:id/settle', requireRole('admin', 'accountant'), validate(settleSeizureSchema), settleSeizure);

module.exports = router;
