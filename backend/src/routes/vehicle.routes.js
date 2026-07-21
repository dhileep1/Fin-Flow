const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createVehicleSchema, updateVehicleSchema } = require('../utils/validation.schemas');
const { listVehicles, createVehicle, updateVehicle, getVehicleById } = require('../controllers/vehicle.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', listVehicles);
router.get('/:id', getVehicleById);
router.post('/', requireRole('admin', 'accountant', 'staff'), validate(createVehicleSchema), createVehicle);
router.put('/:id', requireRole('admin', 'accountant', 'staff'), validate(updateVehicleSchema), updateVehicle);

module.exports = router;
