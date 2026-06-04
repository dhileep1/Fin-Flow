const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { createPayment, getPayments, getReceipt } = require('../controllers/payment.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.post('/', createPayment);
router.get('/', getPayments);
router.get('/:paymentId/receipt', getReceipt);

module.exports = router;
