const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createExpenseSchema } = require('../utils/validation.schemas');
const { createExpense, getExpenses } = require('../controllers/expense.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', getExpenses);
router.post('/', requireRole('admin', 'accountant'), validate(createExpenseSchema), createExpense);

module.exports = router;
