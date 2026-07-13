const prisma = require('../src/config/database');

// Mock prisma database config globally (since it's constant throughout these tests)
jest.mock('../src/config/database', () => {
    return {
        customer: {
            findUnique: jest.fn().mockResolvedValue({ id: 'customer-123', phone: '+919988776655', optOutWhatsapp: false })
        },
        notification: {
            create: jest.fn().mockResolvedValue({ id: 'notif-123' }),
            update: jest.fn(),
            findFirst: jest.fn().mockResolvedValue({ id: 'notif-123', providerMessageId: 'msg-123' }),
        }
    };
});

describe('WhatsApp Notification Service & Webhook', () => {
    let env;

    beforeEach(() => {
        jest.resetModules();
        env = require('../src/config/env');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('renderTemplate', () => {
        it('should correctly format template placeholder variables', () => {
            const { renderTemplate } = require('../src/services/notification.service');
            const template = 'Hi {{customer.name}}, your loan payment of ₹{{payment.amount}} is due on {{payment.dueDate}}.';
            const data = {
                customer: { name: 'Dhileep' },
                payment: { amount: 5000, dueDate: '2026-07-20' }
            };

            const result = renderTemplate(template, data);
            expect(result).toBe('Hi Dhileep, your loan payment of ₹5000 is due on 2026-07-20.');
        });

        it('should leave placeholder unchanged if variable is missing', () => {
            const { renderTemplate } = require('../src/services/notification.service');
            const template = 'Hello {{name}} and {{missing}}';
            const data = { name: 'Dhileep' };

            const result = renderTemplate(template, data);
            expect(result).toBe('Hello Dhileep and {{missing}}');
        });
    });

    describe('sendMessage Mock & Twilio Provider', () => {
        it('should send via mock console/logs if provider is not Twilio', async () => {
            env.whatsappProvider = 'mock';
            env.twilioAccountSid = null;
            env.twilioAuthToken = null;

            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const { sendNotification } = require('../src/services/notification.service');

            const result = await sendNotification({
                orgId: 'org-123',
                customerId: 'customer-123',
                loanId: 'loan-123',
                type: 'manual',
                messageBody: 'Hello Mock World!'
            });

            expect(result.success).toBe(true);
            expect(result.providerMessageId).toBeDefined();
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WhatsApp Mock] Sending to +919988776655: Hello Mock World!')
            );
        });

        it('should invoke twilio client messages create with prefixed phone number and credentials when configured', async () => {
            env.whatsappProvider = 'twilio';
            env.twilioAccountSid = 'ACxxxxxxxxxx';
            env.twilioAuthToken = 'auth_token_secret';
            env.twilioPhoneNumber = 'whatsapp:+14155238886';

            const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM12345' });
            jest.doMock('twilio', () => {
                return jest.fn().mockReturnValue({
                    messages: {
                        create: mockCreate
                    }
                });
            });

            const { sendNotification } = require('../src/services/notification.service');

            const result = await sendNotification({
                orgId: 'org-123',
                customerId: 'customer-123',
                loanId: 'loan-123',
                type: 'manual',
                messageBody: 'Hello Twilio Sandbox!',
                mediaUrl: 'https://example.com/receipt.pdf'
            });

            expect(result.success).toBe(true);
            expect(result.providerMessageId).toBe('SM12345');
            expect(mockCreate).toHaveBeenCalledWith({
                from: 'whatsapp:+14155238886',
                to: 'whatsapp:+919988776655',
                body: 'Hello Twilio Sandbox!',
                mediaUrl: ['https://example.com/receipt.pdf']
            });
        });
    });

    describe('Webhook Router / Route Handler', () => {
        it('should correctly process incoming status callback body and invoke handleWebhook', async () => {
            const { handleWebhook } = require('../src/services/notification.service');
            const handleWebhookSpy = jest.spyOn(require('../src/services/notification.service'), 'handleWebhook')
                .mockResolvedValue({});

            // Retrieve the webhook router callback
            const notificationRoutes = require('../src/routes/notification.routes');
            
            // Find the POST /webhook handler
            const route = notificationRoutes.stack.find(
                layer => layer.route && layer.route.path === '/webhook' && layer.route.methods.post
            );
            expect(route).toBeDefined();

            const webhookHandler = route.route.stack[0].handle;

            const req = {
                body: {
                    MessageSid: 'SM12345',
                    MessageStatus: 'Delivered'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };
            const next = jest.fn();

            await webhookHandler(req, res, next);

            expect(handleWebhookSpy).toHaveBeenCalledWith('SM12345', 'delivered');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('OK');
        });
    });
});
