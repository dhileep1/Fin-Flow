const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');
const env = require('../config/env');

let twilioClient = null;
if (env.twilioAccountSid && env.twilioAuthToken) {
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
}

/**
 * WhatsApp provider adapter interface.
 * Replace the console.log stubs with actual provider (Twilio, Meta WABA, etc.)
 */
class WhatsAppProvider {
    async sendMessage(to, body, mediaUrl = null) {
        if (!twilioClient || env.whatsappProvider !== 'twilio') {
            console.log(`[WhatsApp Mock] Sending to ${to}: ${body}${mediaUrl ? ` [media: ${mediaUrl}]` : ''}`);
            return {
                success: true,
                providerMessageId: `msg_${uuidv4().slice(0, 12)}`,
            };
        }

        let recipient = to;
        if (!recipient.startsWith('whatsapp:')) {
            recipient = `whatsapp:${recipient}`;
        }

        try {
            const payload = {
                from: env.twilioPhoneNumber || 'whatsapp:+14155238886',
                to: recipient,
                body: body,
            };
            if (mediaUrl) {
                payload.mediaUrl = [mediaUrl];
            }

            const message = await twilioClient.messages.create(payload);
            return {
                success: true,
                providerMessageId: message.sid,
            };
        } catch (err) {
            console.error('[Twilio Error] Failed to send message:', err.message);
            throw err;
        }
    }

    async onWebhookStatus(providerMessageId, status) {
        // Update notification status based on provider webhook
        const notification = await prisma.notification.findFirst({
            where: { providerMessageId },
        });
        if (notification) {
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    status: status === 'delivered' || status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'sent',
                    sentAt: status === 'delivered' || status === 'sent' ? new Date() : null,
                },
            });
        }
        return notification;
    }
}

const whatsappProvider = new WhatsAppProvider();

/**
 * Render a template string with placeholders.
 */
function renderTemplate(template, data) {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const keys = path.split('.');
        let value = data;
        for (const key of keys) {
            value = value?.[key];
        }
        return value !== undefined && value !== null ? String(value) : match;
    });
}

/**
 * Send a notification (WhatsApp).
 */
async function sendNotification({ orgId, customerId, loanId, type, messageBody, mediaUrl }) {
    // Check opt-out
    if (customerId) {
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (customer?.optOutWhatsapp && type !== 'manual') {
            return { skipped: true, reason: 'Customer opted out of WhatsApp' };
        }
    }

    const notificationId = uuidv4();

    // Create notification record
    const notification = await prisma.notification.create({
        data: {
            id: notificationId,
            orgId,
            customerId,
            loanId,
            type,
            messageBody,
            status: 'pending',
        },
    });

    // Get customer phone
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer?.phone) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'failed' },
        });
        return { success: false, error: 'No phone number' };
    }

    // Send via provider
    try {
        const result = await whatsappProvider.sendMessage(customer.phone, messageBody, mediaUrl);
        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                providerMessageId: result.providerMessageId,
                status: 'sent',
                sentAt: new Date(),
            },
        });
        return { success: true, notificationId, providerMessageId: result.providerMessageId };
    } catch (err) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'failed' },
        });
        return { success: false, error: err.message };
    }
}

/**
 * Handle webhook status update from WhatsApp provider.
 */
async function handleWebhook(providerMessageId, status) {
    return whatsappProvider.onWebhookStatus(providerMessageId, status);
}

module.exports = { sendNotification, handleWebhook, renderTemplate };
