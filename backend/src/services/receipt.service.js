const PDFDocument = require('pdfkit');
const prisma = require('../config/database');
const { roundHalfUp } = require('../utils/rounding');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');
const logger = require('../utils/logger');

let s3Client = null;
if (env.awsAccessKeyId && env.awsSecretAccessKey) {
    s3Client = new S3Client({
        region: env.awsRegion,
        credentials: {
            accessKeyId: env.awsAccessKeyId,
            secretAccessKey: env.awsSecretAccessKey
        }
    });
}

function formatCurrency(amount) {
    const symbol = env.currencySymbol || '₹';
    return `${symbol}${roundHalfUp(amount).toFixed(2)}`;
}

async function uploadReceiptToS3(receiptId, pdfBuffer) {
    if (!s3Client || !env.s3BucketName) {
        console.log(`[S3 Mock] Mock uploading receipt ${receiptId} (S3 bucket or credentials not set)`);
        return `https://s3.amazonaws.com/mock-bucket/receipts/${receiptId}.pdf`;
    }
    
    const key = `receipts/${receiptId}.pdf`;
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: env.s3BucketName,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
        }));
        return `https://${env.s3BucketName}.s3.${env.awsRegion}.amazonaws.com/${key}`;
    } catch (err) {
        logger.error(`[S3 Error] Upload failed for receipt ${receiptId}`, { error: err.message, stack: err.stack });
        throw err;
    }
}

/**
 * Generate a PDF receipt for a payment and return as a Buffer.
 */
async function generateReceiptPDF(paymentId) {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            loan: {
                include: {
                    customer: true,
                    vehicle: true,
                },
            },
            receipts: true,
            creator: { select: { name: true } },
            org: true,
        },
    });

    if (!payment) throw new Error('Payment not found');

    const receipt = payment.receipts[0];
    const alloc = payment.allocationDetails || [];

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc
            .fontSize(22)
            .font('Helvetica-Bold')
            .text(payment.org?.name || 'Lend Easy', { align: 'center' })
            .moveDown(0.3);

        doc
            .fontSize(10)
            .font('Helvetica')
            .text(payment.org?.address || '', { align: 'center' })
            .text(payment.org?.phone ? `Phone: ${payment.org.phone}` : '', { align: 'center' })
            .moveDown(1);

        // Divider
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc').moveDown(0.5);

        // Receipt title
        doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .text('PAYMENT RECEIPT', { align: 'center' })
            .moveDown(1);

        // Receipt info
        doc.fontSize(10).font('Helvetica');
        const infoY = doc.y;

        doc.text(`Receipt No: ${receipt?.receiptNumber || 'N/A'}`, 50, infoY);
        doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString('en-IN')}`, 350, infoY);
        doc.moveDown(0.5);

        doc.text(`Loan ID: ${payment.loanId.slice(0, 8).toUpperCase()}`, 50);
        doc.text(`Method: ${payment.paymentMethod || 'N/A'}`, 350, doc.y - 14);
        doc.moveDown(1);

        // Customer details
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Customer Details')
            .moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Name: ${payment.loan.customer.name}`);
        doc.text(`Phone: ${payment.loan.customer.phone}`);
        doc.text(`Vehicle: ${payment.loan.vehicle?.vehicleNumber || 'N/A'} (${payment.loan.vehicle?.model || ''})`);
        doc.moveDown(1);

        // Payment breakdown
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Payment Breakdown')
            .moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Due #', 50, tableTop, { width: 50 });
        doc.text('Principal', 110, tableTop, { width: 100, align: 'right' });
        doc.text('Interest', 220, tableTop, { width: 100, align: 'right' });
        doc.text('Penalty', 330, tableTop, { width: 100, align: 'right' });
        doc.text('Total', 440, tableTop, { width: 100, align: 'right' });
        doc.moveDown(0.3);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc').moveDown(0.3);

        // Table rows
        doc.font('Helvetica').fontSize(9);
        let totalPrincipal = 0, totalInterest = 0, totalPenalty = 0;
        for (const item of alloc) {
            const y = doc.y;
            doc.text(`#${item.dueSequence || '-'}`, 50, y, { width: 50 });
            doc.text(formatCurrency(item.principal), 110, y, { width: 100, align: 'right' });
            doc.text(formatCurrency(item.interest), 220, y, { width: 100, align: 'right' });
            doc.text(formatCurrency(item.penalty), 330, y, { width: 100, align: 'right' });
            doc.text(formatCurrency(item.total), 440, y, { width: 100, align: 'right' });
            doc.moveDown(0.3);
            totalPrincipal += item.principal;
            totalInterest += item.interest;
            totalPenalty += item.penalty;
        }

        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc').moveDown(0.3);

        // Totals
        doc.font('Helvetica-Bold').fontSize(10);
        const totY = doc.y;
        doc.text('TOTAL', 50, totY, { width: 50 });
        doc.text(formatCurrency(totalPrincipal), 110, totY, { width: 100, align: 'right' });
        doc.text(formatCurrency(totalInterest), 220, totY, { width: 100, align: 'right' });
        doc.text(formatCurrency(totalPenalty), 330, totY, { width: 100, align: 'right' });
        doc.text(formatCurrency(payment.amount), 440, totY, { width: 100, align: 'right' });
        doc.moveDown(1.5);

        // Outstanding
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Amount Paid: ${formatCurrency(payment.amount)}`);
        doc.text(`Outstanding Principal: ${formatCurrency(payment.loan.outstandingPrincipal)}`);
        doc.moveDown(2);

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#888888');
        doc.text('This is a computer-generated receipt. No signature required.', { align: 'center' });
        doc.text(`Recorded by: ${payment.creator?.name || 'System'}`, { align: 'center' });

        doc.end();
    });
}

async function deleteReceiptFromS3(receiptId) {
    if (!s3Client || !env.s3BucketName) {
        console.log(`[S3 Mock] Mock deleting receipt ${receiptId} (S3 bucket or credentials not set)`);
        return;
    }
    const key = `receipts/${receiptId}.pdf`;
    try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({
            Bucket: env.s3BucketName,
            Key: key
        }));
        logger.info(`[S3 Info] Deleted receipt ${receiptId} from S3`);
    } catch (err) {
        logger.error(`[S3 Error] Delete failed for receipt ${receiptId}`, { error: err.message, stack: err.stack });
    }
}

module.exports = { generateReceiptPDF, uploadReceiptToS3, deleteReceiptFromS3 };
