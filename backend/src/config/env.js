require('dotenv').config();

if (!process.env.DATABASE_URL) {
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is missing.');
}

if (!process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET environment variable is missing.');
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'dev-secret') {
    throw new Error('FATAL ERROR: JWT_SECRET cannot be "dev-secret" in production.');
}

if (process.env.NODE_ENV === 'production' && (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32)) {
    throw new Error('FATAL ERROR: ENCRYPTION_KEY must be set and at least 32 characters in production.');
}

if (process.env.NODE_ENV === 'production' && process.env.WHATSAPP_PROVIDER === 'twilio') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        throw new Error('FATAL ERROR: Twilio configuration (account SID, auth token, and phone number) must be fully specified in production when using twilio provider.');
    }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  nodeEnv: process.env.NODE_ENV || 'development',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-long',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  
  // Twilio
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,

  // S3
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3BucketName: process.env.S3_BUCKET_NAME,

  // Currency
  currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
  currencyLocale: process.env.CURRENCY_LOCALE || 'en-IN',
};

// MOD-11: Warn if production CORS origins use plain HTTP
if (process.env.NODE_ENV === 'production' && process.env.CORS_ALLOWED_ORIGINS) {
    const origins = process.env.CORS_ALLOWED_ORIGINS.split(',');
    const httpOrigins = origins.filter(o => o.trim().startsWith('http://') && !o.includes('localhost'));
    if (httpOrigins.length > 0) {
        console.warn(`[SECURITY WARNING] Production CORS origins using plain HTTP: ${httpOrigins.join(', ')}. Consider using HTTPS.`);
    }
}
