const { PrismaClient } = require('@prisma/client');
const { encrypt, decrypt, generateHash } = require('../utils/encryption');

// MOD-5: Configure connection pooling for production workloads
const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

const prisma = basePrisma.$extends({
    result: {
        customer: {
            aadharNumber: {
                needs: { aadharNumber: true },
                compute(customer) {
                    if (!customer.aadharNumber) return customer.aadharNumber;
                    return decrypt(customer.aadharNumber);
                }
            }
        },
        guarantor: {
            aadharNumber: {
                needs: { aadharNumber: true },
                compute(guarantor) {
                    if (!guarantor.aadharNumber) return guarantor.aadharNumber;
                    return decrypt(guarantor.aadharNumber);
                }
            }
        }
    },
    query: {
        customer: {
            async $allOperations({ operation, args, query }) {
                if (['create', 'update', 'upsert'].includes(operation)) {
                    if (args.data?.aadharNumber) {
                        const rawAadhar = args.data.aadharNumber;
                        args.data.aadharHash = generateHash(rawAadhar);
                        args.data.aadharNumber = encrypt(rawAadhar);
                    }
                }
                return query(args);
            }
        },
        guarantor: {
            async $allOperations({ operation, args, query }) {
                if (['create', 'update', 'upsert'].includes(operation)) {
                    if (args.data?.aadharNumber) {
                        const rawAadhar = args.data.aadharNumber;
                        args.data.aadharHash = generateHash(rawAadhar);
                        args.data.aadharNumber = encrypt(rawAadhar);
                    }
                }
                return query(args);
            }
        }
    }
});

// Graceful connection testing on startup
prisma.$connect()
    .then(() => {
        if (process.env.NODE_ENV !== 'test') {
            console.log('[Database] Connected successfully');
        }
    })
    .catch((err) => {
        console.error('[Database] Connection failed:', err.message);
    });

module.exports = prisma;
