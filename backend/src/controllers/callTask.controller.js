const callTaskService = require('../services/callTask.service');

async function getCallTasks(req, res, next) {
    try {
        const { assigned_to, due_before, page, limit } = req.query;
        const result = await callTaskService.getCallQueue(req.orgId, {
            assignedStaffId: assigned_to,
            dueBefore: due_before,
            page: Number(page) || 1,
            limit: Number(limit) || 25,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function createCallLog(req, res, next) {
    try {
        const { callTaskId, callDate, outcome, notes, promisedPaymentAmount, promisedPaymentDate, nextFollowupDate } = req.body;

        if (!callTaskId) {
            return res.status(400).json({ error: 'callTaskId is required' });
        }

        const callLog = await callTaskService.logCall({
            callTaskId,
            userId: req.user.id,
            callDate,
            outcome,
            notes,
            promisedPaymentAmount,
            promisedPaymentDate,
            nextFollowupDate,
        });

        res.status(201).json(callLog);
    } catch (err) {
        next(err);
    }
}

module.exports = { getCallTasks, createCallLog };
