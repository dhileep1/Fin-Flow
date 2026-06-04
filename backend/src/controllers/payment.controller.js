const paymentService = require('../services/payment.service');
const receiptService = require('../services/receipt.service');

async function createPayment(req, res, next) {
    try {
        const { loanId, amount, paymentMethod, referenceNumber } = req.body;

        if (!loanId || !amount) {
            return res.status(400).json({ error: 'loanId and amount are required' });
        }

        if (Number(amount) <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const result = await paymentService.recordPayment({
            orgId: req.orgId,
            loanId,
            amount,
            paymentMethod,
            referenceNumber,
            createdBy: req.user.id,
        });

        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
}

async function getPayments(req, res, next) {
    try {
        const loanId = req.params.loanId || req.query.loanId;
        if (!loanId) return res.status(400).json({ error: 'loanId is required' });

        const payments = await paymentService.getPaymentsByLoan(req.orgId, loanId);
        res.json(payments);
    } catch (err) {
        next(err);
    }
}

async function getReceipt(req, res, next) {
    try {
        const pdfBuffer = await receiptService.generateReceiptPDF(req.params.paymentId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=receipt-${req.params.paymentId}.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

module.exports = { createPayment, getPayments, getReceipt };
