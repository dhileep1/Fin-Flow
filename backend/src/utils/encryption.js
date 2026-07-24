const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// SEC-6: Fail fast on invalid key length — never silently pad or truncate
const rawKey = config.encryptionKey || '';
if (config.nodeEnv === 'production' && rawKey.length !== 32) {
    throw new Error(
        `FATAL: ENCRYPTION_KEY must be exactly 32 characters. Got ${rawKey.length}. ` +
        'Set a proper 32-character key in your environment.'
    );
}
// In development, allow dev fallback but warn
let key = rawKey;
if (key.length < 32) {
    if (config.nodeEnv !== 'test') {
        logger.warn(`[Encryption] Key is ${key.length} chars (need 32). Using padded dev key. THIS IS NOT SAFE FOR PRODUCTION.`);
    }
    key = key.padEnd(32, '0');
} else if (key.length > 32) {
    key = key.slice(0, 32);
}

const keyBuffer = Buffer.from(key, 'utf8');

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

module.exports = { encrypt, decrypt };
