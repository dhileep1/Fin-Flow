const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function createExpense({ orgId, amount, category, description, tags, createdBy, expenseDate }) {
    return prisma.expense.create({
        data: {
            id: uuidv4(),
            orgId,
            amount: Number(amount),
            category,
            description,
            tags: tags || [],
            createdBy,
            ...(expenseDate && { expenseDate: new Date(expenseDate) })
        },
        include: {
            creator: { select: { name: true } }
        }
    });
}

async function getExpenses(orgId) {
    return prisma.expense.findMany({
        where: { orgId },
        include: {
            creator: { select: { name: true } }
        },
        orderBy: { expenseDate: 'desc' }
    });
}

module.exports = { createExpense, getExpenses };
