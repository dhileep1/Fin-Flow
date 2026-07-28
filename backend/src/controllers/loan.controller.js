const loanService = require('../services/loan.service');
const prisma = require('../config/database');
const { logAudit } = require('../services/audit.service');

async function createLoan(req, res, next) {
    try {
        const { customerId, vehicleId, principalAmount, tenureMonths, monthlyInterestRate, startDate, assignedStaffId, guarantors } = req.body;

        if (!customerId || !vehicleId || !principalAmount || !tenureMonths || !monthlyInterestRate || !startDate) {
            return res.status(400).json({ error: 'Missing required fields: customerId, vehicleId, principalAmount, tenureMonths, monthlyInterestRate, startDate' });
        }

        if (!guarantors || !Array.isArray(guarantors) || guarantors.length === 0) {
            return res.status(400).json({ error: 'Guarantor (Jamin) name and phone number are compulsory.' });
        }

        for (let i = 0; i < guarantors.length; i++) {
            const g = guarantors[i];
            if (!g || typeof g !== 'object' || !g.name?.trim() || !g.phone?.trim()) {
                return res.status(400).json({ error: `Guarantor #${i + 1} must have a valid name and phone number.` });
            }
        }

        const loan = await loanService.createLoan({
            orgId: req.orgId,
            customerId,
            vehicleId,
            assignedStaffId,
            principalAmount,
            tenureMonths: Number(tenureMonths),
            monthlyInterestRate,
            startDate,
            userId: req.user.id,
            guarantors,
        });

        res.status(201).json(loan);
    } catch (err) {
        next(err);
    }
}

async function getLoan(req, res, next) {
    try {
        const loan = await loanService.getLoanById(req.orgId, req.params.id);
        if (!loan) return res.status(404).json({ error: 'Loan not found' });
        res.json(loan);
    } catch (err) {
        next(err);
    }
}

async function listLoans(req, res, next) {
    try {
        const { status, customerId, assignedStaffId, page, limit, q, type } = req.query;
        const result = await loanService.listLoans(req.orgId, {
            status,
            customerId,
            assignedStaffId,
            page: Number(page) || 1,
            limit: Number(limit) || 25,
            q,
            type,
        });
        
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function getDues(req, res, next) {
    try {
        const { filter, loanId, limit = 50, page = 1 } = req.query;
        const where = { orgId: req.orgId };
        if (loanId) where.loanId = loanId;

        if (filter === 'pending') where.status = 'pending';
        else if (filter === 'paid') where.status = 'paid';
        else if (filter === 'upcoming') where.status = 'upcoming';
        else if (filter === 'overdue') {
            where.status = { not: 'paid' };
            where.dueDate = { lt: new Date() };
        }

        const [dues, total] = await Promise.all([
            prisma.loanDue.findMany({
                where,
                include: {
                    loan: {
                        include: {
                            customer: { select: { name: true, phone: true, aadharNumber: true } },
                            vehicle: { select: { vehicleNumber: true } },
                        },
                    },
                },
                orderBy: { dueDate: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.loanDue.count({ where }),
        ]);

        res.json({ dues: dues, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        next(err);
    }
}

async function getForeclosureQuote(req, res, next) {
    try {
        const { foreclosureRate } = req.query;
        if (!foreclosureRate) {
            return res.status(400).json({ error: 'foreclosureRate is required' });
        }
        const rate = Number(foreclosureRate);
        if (isNaN(rate) || rate < 0 || rate > 1) {
            return res.status(400).json({ error: 'foreclosureRate must be a positive number up to 1 (100%)' });
        }

        const quote = await loanService.calculateForeclosureQuote(req.orgId, req.params.id, rate);
        res.json(quote);
    } catch (err) {
        next(err);
    }
}

async function forecloseLoan(req, res, next) {
    try {
        const { foreclosureRate, paymentMethod, referenceNumber, paymentDate } = req.body;
        if (!foreclosureRate) {
            return res.status(400).json({ error: 'foreclosureRate is required' });
        }
        const rate = Number(foreclosureRate);
        if (isNaN(rate) || rate < 0 || rate > 1) {
            return res.status(400).json({ error: 'foreclosureRate must be a positive number up to 1 (100%)' });
        }

        const result = await loanService.executeForeclosure(req.orgId, req.params.id, {
            foreclosureRate: rate,
            paymentMethod,
            referenceNumber,
            createdBy: req.user.id,
            paymentDate
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function closeLoan(req, res, next) {
    try {
        const result = await loanService.closeLoan(req.orgId, req.params.id, req.user.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = { createLoan, getLoan, listLoans, getDues, getForeclosureQuote, forecloseLoan, closeLoan };

