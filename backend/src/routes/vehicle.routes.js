const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { listVehicles, createVehicle, updateVehicle } = require('../controllers/vehicle.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', listVehicles);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);

module.exports = router;
