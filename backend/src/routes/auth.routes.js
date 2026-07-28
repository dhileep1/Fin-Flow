const express = require('express');
const {
    login,
    requestOtp,
    verifyOtpAndResetPassword,
    requestSuperAdminReset,
    resetWithSuperAdminPermission
} = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const {
    loginSchema,
    requestOtpSchema,
    verifyOtpSchema,
    requestSuperAdminResetSchema
} = require('../utils/validation.schemas');

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/forgot-password/request-otp', validate(requestOtpSchema), requestOtp);
router.post('/forgot-password/verify-otp', validate(verifyOtpSchema), verifyOtpAndResetPassword);
router.post('/forgot-password/request-superadmin', validate(requestSuperAdminResetSchema), requestSuperAdminReset);
router.post('/forgot-password/reset-superadmin', resetWithSuperAdminPermission);

module.exports = router;
