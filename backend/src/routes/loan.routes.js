const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createLoanSchema, forecloseLoanSchema } = require('../utils/validation.schemas');
const { createLoan, getLoan, listLoans, getDues, getForeclosureQuote, forecloseLoan } = require('../controllers/loan.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', listLoans);
router.get('/dues', getDues);
router.get('/:id', getLoan);
router.get('/:id/foreclosure-quote', getForeclosureQuote);
router.post('/:id/foreclose', requireRole('admin', 'accountant'), validate(forecloseLoanSchema), forecloseLoan);
router.post('/', requireRole('admin', 'accountant'), validate(createLoanSchema), createLoan);

module.exports = router;
