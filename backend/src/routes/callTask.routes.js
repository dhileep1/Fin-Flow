const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { getCallTasks, createCallLog } = require('../controllers/callTask.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', getCallTasks);
router.post('/logs', createCallLog);

module.exports = router;
