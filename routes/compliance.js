const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const Compliance = require('../models/Compliance');
const User = require('../models/User');
const { protect, adminOnly, allow, mineScope } = require('../middleware/auth');

// ---------- file upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Visibility:
 *  admin      -> all (optional ?mine=)
 *  supervisor -> their mine, optionally narrowed to their reportees
 *  user       -> only what is assigned to them
 */
const scopeFilter = async (req) => {
  if (req.user.role === 'user') return { assignedTo: req.user._id };

  const filter = mineScope(req);

  if (req.user.role === 'supervisor') {
    const reportees = await User.find({ reportsTo: req.user._id }).select('_id');
    filter.assignedTo = { $in: [...reportees.map((r) => r._id), req.user._id] };
  }
  return filter;
};

// GET /api/compliances
router.get('/', protect, async (req, res) => {
  try {
    const filter = await scopeFilter(req);
    const { category, subCategory, status, assignedTo, search } = req.query;

    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    if (status) filter.status = status;
    if (assignedTo && req.user.role !== 'user') filter.assignedTo = assignedTo;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { complianceId: { $regex: search, $options: 'i' } },
        { act: { $regex: search, $options: 'i' } },
      ];
    }

    const compliances = await Compliance.find(filter)
      .populate('mine', 'name code type')
      .populate('assignedTo', 'name email dept')
      .sort({ dueDate: 1, category: 1 });

    res.json(compliances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliances/stats — dashboard counters
router.get('/stats', protect, async (req, res) => {
  try {
    const filter = await scopeFilter(req);
    const rows = await Compliance.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = { Pending: 0, Upcoming: 0, 'Due This Month': 0, Overdue: 0, Completed: 0 };
    rows.forEach((r) => (stats[r._id] = r.count));
    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);

    const byCategory = await Compliance.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ stats, byCategory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/compliances/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const c = await Compliance.findById(req.params.id)
      .populate('mine', 'name code type')
      .populate('assignedTo', 'name email dept');
    if (!c) return res.status(404).json({ message: 'Compliance not found' });

    if (req.user.role === 'user' && String(c.assignedTo?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (
      req.user.role === 'supervisor' &&
      String(c.mine?._id) !== String(req.user.mine)
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliances
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const c = await Compliance.create(req.body);
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/compliances/bulk — seed a mine's register in one call
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'items[] is required' });
    }
    const created = await Compliance.insertMany(items, { ordered: false });
    res.status(201).json({ inserted: created.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/compliances/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const c = await Compliance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!c) return res.status(404).json({ message: 'Compliance not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/compliances/:id/assign
router.patch('/:id/assign', protect, adminOnly, async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const c = await Compliance.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Compliance not found' });

    const user = await User.findById(assignedTo);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'admin' && String(user.mine) !== String(c.mine)) {
      return res
        .status(400)
        .json({ message: 'User does not belong to this compliance\u2019s mine' });
    }

    c.assignedTo = assignedTo;
    // reset escalation trail on reassignment
    c.lastReminderAt = null;
    c.supervisorEscalatedAt = null;
    c.adminEscalatedAt = null;
    await c.save();

    res.json(await c.populate('assignedTo', 'name email dept'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/compliances/:id/complete — assigned user (or admin) uploads proof
router.patch(
  '/:id/complete',
  protect,
  upload.array('proofs', 5),
  async (req, res) => {
    try {
      const c = await Compliance.findById(req.params.id);
      if (!c) return res.status(404).json({ message: 'Compliance not found' });

      const isOwner = String(c.assignedTo) === String(req.user._id);
      if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      (req.files || []).forEach((f) =>
        c.proofs.push({
          fileName: f.originalname,
          filePath: path.join('uploads', f.filename),
          uploadedBy: req.user._id,
        })
      );

      if (req.body.driveLink) c.driveLink = req.body.driveLink;
      c.status = 'Completed';
      c.completedDate = new Date();
      await c.save();

      res.json(c);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/compliances/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const c = await Compliance.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: 'Compliance not found' });
    res.json({ message: 'Compliance deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
