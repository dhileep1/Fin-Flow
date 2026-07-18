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

async function getExpenses(orgId, { page = 1, limit = 25 } = {}) {
    const skip = (page - 1) * limit;
    const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
            where: { orgId },
            skip,
            take: limit,
            include: {
                creator: { select: { name: true } }
            },
            orderBy: { expenseDate: 'desc' }
        }),
        prisma.expense.count({ where: { orgId } })
    ]);
    return {
        expenses,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

module.exports = { createExpense, getExpenses };
