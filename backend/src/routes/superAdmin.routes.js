const express = require('express');
const router = express.Router();
const { superAdminAuth } = require('../middleware/superAdminAuth');

// Controllers
const authController = require('../controllers/superAdmin.auth.controller');
const orgController = require('../controllers/superAdmin.org.controller');
const systemController = require('../controllers/superAdmin.system.controller');

// ─── Public Routes (no auth) ────────────────────────────────
router.post('/auth/login', authController.login);

// ─── Protected Routes (superAdminAuth required) ─────────────
router.use(superAdminAuth);

// Dashboard
router.get('/dashboard', orgController.getDashboardStats);

// Organization / Tenant management
router.get('/orgs', orgController.listOrgs);
router.post('/orgs', orgController.provisionOrg);
router.patch('/orgs/:id/status', orgController.updateOrgStatus);
router.post('/orgs/:id/impersonate', orgController.impersonate);
router.post('/users/:userId/reset-password', orgController.resetUserPassword);

// System health & queue monitoring
router.get('/system/health', systemController.getSystemHealth);
router.get('/system/queues', systemController.getQueueStats);
router.post('/system/queues/retry', systemController.retryFailedJobs);

module.exports = router;
