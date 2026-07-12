const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { createCallLogSchema } = require('../utils/validation.schemas');
const { getCallTasks, createCallLog } = require('../controllers/callTask.controller');
const router = express.Router({ mergeParams: true });

router.use(authenticate, tenantScope);

router.get('/', getCallTasks);
router.post('/logs', requireRole('admin', 'accountant', 'staff'), validate(createCallLogSchema), createCallLog);

module.exports = router;
