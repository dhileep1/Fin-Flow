const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { seizeVehicleSchema } = require('../utils/validation.schemas');
const { seizeVehicle, getSeizedInventory, settleSeizure, getVehicleSales } = require('../controllers/seizure.controller');

const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.post('/', requireRole('admin', 'accountant'), validate(seizeVehicleSchema), seizeVehicle);
router.get('/inventory', getSeizedInventory);
router.get('/sales', getVehicleSales);

router.post('/:id/settle', requireRole('admin', 'accountant'), settleSeizure);

module.exports = router;
