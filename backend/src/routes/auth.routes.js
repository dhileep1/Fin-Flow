const express = require('express');
const { login } = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { loginSchema } = require('../utils/validation.schemas');
const router = express.Router({ mergeParams: true });

router.post('/login', validate(loginSchema), login);

module.exports = router;
