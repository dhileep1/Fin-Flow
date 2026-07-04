require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { startWorkers } = require('./jobs/worker');

const app = express();

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Health check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
const API_PREFIX = '/api/v1/:orgId';

app.use(`${API_PREFIX}/auth`, require('./routes/auth.routes'));
app.use(`${API_PREFIX}/customers`, require('./routes/customer.routes'));
app.use(`${API_PREFIX}/vehicles`, require('./routes/vehicle.routes'));
app.use(`${API_PREFIX}/seizures`, require('./routes/seizure.routes'));
app.use(`${API_PREFIX}/loans`, require('./routes/loan.routes'));
app.use(`${API_PREFIX}/payments`, require('./routes/payment.routes'));
app.use(`${API_PREFIX}/expenses`, require('./routes/expense.routes'));
app.use(`${API_PREFIX}/call-tasks`, require('./routes/callTask.routes'));
app.use(`${API_PREFIX}/notifications`, require('./routes/notification.routes'));
app.use(`${API_PREFIX}/reports`, require('./routes/report.routes'));
app.use(`${API_PREFIX}/search`, require('./routes/search.routes'));
app.use(`${API_PREFIX}/admin`, require('./routes/admin.routes'));

// --- Error handler ---
app.use(errorHandler);

// --- Start server ---
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`[LendEasy] Server running on port ${PORT}`);
    console.log(`[LendEasy] API: http://localhost:${PORT}/api/v1/{orgId}`);

    // Start background workers
    if (config.nodeEnv !== 'test') {
        startWorkers();
    }
});

module.exports = app;
