const expenseService = require('../services/expense.service');

async function createExpense(req, res, next) {
    try {
        const { amount, category, description, tags, expenseDate, vehicleId } = req.body;

        if (!amount || !category) {
            return res.status(400).json({ error: 'Amount and Category are required' });
        }

        if (Number(amount) <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const expense = await expenseService.createExpense({
            orgId: req.orgId,
            amount,
            category,
            description,
            tags,
            createdBy: req.user.id,
            expenseDate,
            vehicleId
        });

        res.status(201).json(expense);
    } catch (err) {
        next(err);
    }
}

async function getExpenses(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const result = await expenseService.getExpenses(req.orgId, { page, limit });
        res.json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = { createExpense, getExpenses };
