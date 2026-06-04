/**
 * Global error handler middleware.
 */
function errorHandler(err, req, res, next) {
    console.error('[Error]', err.message, err.stack);

    if (err.code === 'P2002') {
        return res.status(409).json({ error: 'A record with this data already exists' });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Record not found' });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

module.exports = { errorHandler };
