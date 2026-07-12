const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createCustomerSchema, updateCustomerSchema } = require('../utils/validation.schemas');
const { listCustomers, getCustomer, createCustomer, updateCustomer } = require('../controllers/customer.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', requireRole('admin', 'accountant', 'staff'), validate(createCustomerSchema), createCustomer);
router.put('/:id', requireRole('admin', 'accountant', 'staff'), validate(updateCustomerSchema), updateCustomer);

module.exports = router;
