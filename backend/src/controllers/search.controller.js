const searchService = require('../services/search.service');

async function searchAll(req, res, next) {
    try {
        const { q, limit, type } = req.query;
        const results = await searchService.search(req.orgId, q, { 
            limit: Number(limit) || 25,
            type 
        });
        res.json(results);
    } catch (err) {
        next(err);
    }
}

module.exports = { searchAll };
