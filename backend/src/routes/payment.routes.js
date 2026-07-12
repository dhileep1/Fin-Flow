const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createPaymentSchema } = require('../utils/validation.schemas');
const { createPayment, getPayments, getReceipt } = require('../controllers/payment.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.post('/', requireRole('admin', 'accountant', 'staff'), validate(createPaymentSchema), createPayment);
router.get('/', getPayments);
router.get('/:paymentId/receipt', getReceipt);

module.exports = router;
