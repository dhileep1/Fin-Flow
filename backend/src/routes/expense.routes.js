const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { createExpense, getExpenses } = require('../controllers/expense.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', getExpenses);
router.post('/', createExpense);

module.exports = router;
