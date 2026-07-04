const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const { createLoan, getLoan, listLoans, getDues, getForeclosureQuote, forecloseLoan } = require('../controllers/loan.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', listLoans);
router.get('/dues', getDues);
router.get('/:id', getLoan);
router.get('/:id/foreclosure-quote', getForeclosureQuote);
router.post('/:id/foreclose', requireRole('admin', 'accountant'), forecloseLoan);
router.post('/', requireRole('admin', 'accountant'), createLoan);

module.exports = router;
