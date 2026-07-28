const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const rawKey = config.encryptionKey || 'finflow-default-secret-key-32b';
// SEC-6: Deterministically derive a cryptographically secure 32-byte key buffer using SHA-256
const keyBuffer = crypto.createHash('sha256').update(rawKey).digest();

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (e) {
        // SEC-6: Never return plaintext on encryption failure
        logger.error('Encryption failed — refusing to store plaintext', { error: e.message, stack: e.stack });
        throw new Error('Encryption failed. Cannot store sensitive data in plaintext.');
    }
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length < 2) return text; // Not encrypted, return as is
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        logger.error('Decryption failed', { error: e.message, stack: e.stack });
        return text;
    }
}

function generateHash(text) {
    if (!text) return text;
    try {
        return crypto.createHmac('sha256', keyBuffer).update(text, 'utf8').digest('hex');
    } catch (e) {
        logger.error('Hashing failed', { error: e.message, stack: e.stack });
        return null;
    }
}

module.exports = { encrypt, decrypt, generateHash };
