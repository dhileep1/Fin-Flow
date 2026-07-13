const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'lend-easy-backend' },
    transports: [
        new transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? format.json()
                : format.combine(
                    format.colorize(),
                    format.printf(({ level, message, timestamp, stack }) => {
                        return `${timestamp} [${level}]: ${stack || message}`;
                    })
                )
        })
    ]
});

module.exports = logger;
