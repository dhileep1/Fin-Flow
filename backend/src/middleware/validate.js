const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        req.body = parsed.body;
        req.query = parsed.query;
        req.params = parsed.params;
        next();
    } catch (err) {
        const issues = err.errors || err.issues || [];
        const details = issues.map(e => `${e.path.slice(1).join('.') || e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
            error: 'Validation failed',
            details: details.length > 0 ? details : [err.message]
        });
    }
};

module.exports = validate;
