const { v4: uuidv4 } = require('uuid');

/**
 * ARCH-1: Request ID middleware for correlation tracking.
 * Generates a unique request ID and attaches it to the request/response.
 * Uses incoming X-Request-Id header if present (for distributed tracing).
 */
function requestId(req, res, next) {
    const id = req.headers['x-request-id'] || uuidv4();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = requestId;
