const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { getCollectionsReport, getDashboardStats } = require('../controllers/report.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/collections', getCollectionsReport);
router.get('/dashboard', getDashboardStats);

module.exports = router;
