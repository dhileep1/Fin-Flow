const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

let key = config.encryptionKey || 'dev-encryption-key-32-chars-long';
if (key.length < 32) {
    key = key.padEnd(32, 'x');
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
        console.error('Encryption failed', e);
        return text;
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
        console.error('Decryption failed', e);
        return text;
    }
}

module.exports = { encrypt, decrypt };
