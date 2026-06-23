const expenseService = require('../services/expense.service');

async function createExpense(req, res, next) {
    try {
        const { amount, category, description, tags, expenseDate } = req.body;

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
            expenseDate
        });

        res.status(201).json(expense);
    } catch (err) {
        next(err);
    }
}

async function getExpenses(req, res, next) {
    try {
        const expenses = await expenseService.getExpenses(req.orgId);
        res.json(expenses);
    } catch (err) {
        next(err);
    }
}

module.exports = { createExpense, getExpenses };
