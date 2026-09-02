const express = require('express');
const router = express.Router();
const AlertLog = require('../models/AlertLog');
const { protect, adminOnly, allow, mineScope } = require('../middleware/auth');

/**
 * GET /api/alertlogs
 *  admin      -> all (optional ?mine=&alertType=)
 *  supervisor -> logs for their mine
 *  user       -> only their own alerts
 */
router.get('/', protect, async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'user') filter = { user: req.user._id };
    else filter = mineScope(req);

    if (req.query.alertType) filter.alertType = req.query.alertType;

    const logs = await AlertLog.find(filter)
      .populate('compliance', 'complianceId title category dueDate')
      .populate('user', 'name email')
      .populate('mine', 'name code')
      .sort({ sentAt: -1 })
      .limit(Number(req.query.limit) || 200);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alertlogs/escalations — supervisor's escalation inbox
router.get('/escalations', protect, allow('admin', 'supervisor'), async (req, res) => {
  try {
    const filter = mineScope(req);
    filter.alertType = { $in: ['escalation-supervisor', 'escalation-admin'] };

    const logs = await AlertLog.find(filter)
      .populate('compliance', 'complianceId title category dueDate status')
      .populate('user', 'name email dept')
      .sort({ sentAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/alertlogs/run — manually trigger the daily job (testing)
router.post('/run', protect, adminOnly, async (req, res) => {
  try {
    const { runDaily } = require('../utils/scheduler');
    await runDaily();
    res.json({ message: 'Scheduler run complete' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
