const loanService = require('../services/loan.service');
const prisma = require('../config/database');
const { logAudit } = require('../services/audit.service');
const { encrypt, decrypt } = require('../utils/encryption');
const { v4: uuidv4 } = require('uuid');

function decryptLoan(loan) {
    if (!loan) return loan;
    if (loan.customer) {
        loan.customer.aadharNumber = decrypt(loan.customer.aadharNumber);
    }
    if (loan.guarantors) {
        loan.guarantors = loan.guarantors.map(g => ({
            ...g,
            aadharNumber: decrypt(g.aadharNumber)
        }));
    }
    return loan;
}

async function createLoan(req, res, next) {
    try {
        const { customerId, vehicleId, principalAmount, tenureMonths, monthlyInterestRate, startDate, assignedStaffId, guarantors } = req.body;

        if (!customerId || !vehicleId || !principalAmount || !tenureMonths || !monthlyInterestRate || !startDate) {
            return res.status(400).json({ error: 'Missing required fields: customerId, vehicleId, principalAmount, tenureMonths, monthlyInterestRate, startDate' });
        }

        if (!guarantors || !Array.isArray(guarantors) || guarantors.length === 0 || !guarantors[0].name?.trim() || !guarantors[0].phone?.trim()) {
            return res.status(400).json({ error: 'Guarantor (Jamin) name and phone number are compulsory.' });
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
        });

        // Add guarantors if provided
        if (guarantors && Array.isArray(guarantors) && guarantors.length > 0) {
            for (const g of guarantors) {
                let customerId = g.customerId;

                // If customerId is not provided, check by phone or create new customer
                if (!customerId && g.phone) {
                    const existingCustomer = await prisma.customer.findFirst({
                        where: {
                            orgId: req.orgId,
                            phone: g.phone
                        }
                    });
                    if (existingCustomer) {
                        customerId = existingCustomer.id;
                    } else if (g.name) {
                        const newCustomer = await prisma.customer.create({
                            data: {
                                orgId: req.orgId,
                                name: g.name,
                                phone: g.phone,
                                aadharNumber: g.aadharNumber ? encrypt(g.aadharNumber.replace(/\s/g, '')) : null,
                                address: g.address,
                            }
                        });
                        customerId = newCustomer.id;
                    }
                }

                await prisma.guarantor.create({
                    data: {
                        id: uuidv4(),
                        orgId: req.orgId,
                        loanId: loan.id,
                        customerId: customerId || null,
                        name: g.name,
                        phone: g.phone,
                        aadharNumber: g.aadharNumber ? encrypt(g.aadharNumber) : null,
                        address: g.address,
                        photoUrl: g.photoUrl,
                    },
                });
            }
        }

        // Re-fetch with guarantors
        const fullLoan = await loanService.getLoanById(req.orgId, loan.id);
        res.status(201).json(decryptLoan(fullLoan));
    } catch (err) {
        next(err);
    }
}

async function getLoan(req, res, next) {
    try {
        const loan = await loanService.getLoanById(req.orgId, req.params.id);
        if (!loan) return res.status(404).json({ error: 'Loan not found' });
        res.json(decryptLoan(loan));
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
        
        result.loans = result.loans.map(loan => {
            if (loan.customer) {
                loan.customer.aadharNumber = decrypt(loan.customer.aadharNumber);
            }
            return loan;
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

        const decryptedDues = dues.map(d => {
            if (d.loan && d.loan.customer) {
                d.loan.customer.aadharNumber = decrypt(d.loan.customer.aadharNumber);
            }
            return d;
        });

        res.json({ dues: decryptedDues, total, page: Number(page), limit: Number(limit) });
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
        if (isNaN(rate) || rate < 0) {
            return res.status(400).json({ error: 'foreclosureRate must be a positive number' });
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
        if (isNaN(rate) || rate < 0) {
            return res.status(400).json({ error: 'foreclosureRate must be a positive number' });
        }

        const result = await loanService.executeForeclosure(req.orgId, req.params.id, {
            foreclosureRate: rate,
            paymentMethod,
            referenceNumber,
            createdBy: req.user.id,
            paymentDate
        });

        res.json(decryptLoan(result));
    } catch (err) {
        next(err);
    }
}

module.exports = { createLoan, getLoan, listLoans, getDues, getForeclosureQuote, forecloseLoan };

