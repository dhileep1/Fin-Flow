const express = require('express');
const { login, register } = require('../controllers/auth.controller');
const router = express.Router({ mergeParams: true });

router.post('/login', login);
router.post('/register', register);

module.exports = router;
