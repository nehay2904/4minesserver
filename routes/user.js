const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Compliance = require('../models/Compliance');
const { protect, adminOnly, allow } = require('../middleware/auth');

/**
 * GET /api/users
 *  admin      -> all users (optional ?mine=&role=&dept=)
 *  supervisor -> only their direct reportees
 *  user       -> 403
 */
router.get('/', protect, allow('admin', 'supervisor'), async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = {};
      if (req.query.mine) filter.mine = req.query.mine;
      if (req.query.role) filter.role = req.query.role;
      if (req.query.dept) filter.dept = req.query.dept;
    } else {
      filter = { reportsTo: req.user._id };
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('mine', 'name code type')
      .populate('reportsTo', 'name email role')
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/users/hierarchy
 *  admin      -> full org tree across all mines
 *  supervisor -> own slice: their reporting officer(s) above + their reportees below
 */
router.get('/hierarchy', protect, allow('admin', 'supervisor'), async (req, res) => {
  try {
    if (req.user.role === 'supervisor') {
      const [above, below] = await Promise.all([
        User.find({ _id: { $in: req.user.reportsTo || [] } })
          .select('name email role dept designation')
          .populate('mine', 'name code'),
        User.find({ reportsTo: req.user._id })
          .select('name email role dept designation')
          .populate('mine', 'name code')
          .sort({ name: 1 }),
      ]);

      const self = await User.findById(req.user._id)
        .select('name email role dept designation')
        .populate('mine', 'name code');

      return res.json({ scope: 'supervisor', above, self, below });
    }

    // Admin: build a nested tree per mine. A user with multiple supervisors
    // appears under each of them.
    const filter = req.query.mine ? { mine: req.query.mine } : {};
    const users = await User.find(filter)
      .select('name email role dept designation mine reportsTo isActive')
      .populate('mine', 'name code type')
      .lean();

    const byId = new Map(users.map((u) => [String(u._id), { ...u, reportees: [] }]));
    const roots = [];

    byId.forEach((node) => {
      const parentIds = (node.reportsTo || []).map(String).filter((id) => byId.has(id));
      if (parentIds.length) {
        parentIds.forEach((pid) => byId.get(pid).reportees.push(node));
      } else {
        roots.push(node);
      }
    });

    res.json({ scope: 'admin', tree: roots });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', protect, allow('admin', 'supervisor'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('mine', 'name code type')
      .populate('reportsTo', 'name email role');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (
      req.user.role === 'supervisor' &&
      !(user.reportsTo || []).some((r) => String(r._id) === String(req.user._id))
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    Object.assign(user, rest);
    if (password) user.password = password; // re-hashed by pre-save hook
    if (user.role === 'admin') user.mine = null;

    await user.save();
    res.json(await User.findById(user._id).select('-password'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/users/:id/status — activate / deactivate
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: !!req.body.isActive },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id — blocked while compliances are assigned
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const assigned = await Compliance.countDocuments({
      assignedTo: req.params.id,
      status: { $ne: 'Completed' },
    });
    if (assigned) {
      return res.status(400).json({
        message: `Cannot delete: ${assigned} open compliance(s) assigned. Reassign them first.`,
      });
    }
    await User.updateMany({ reportsTo: req.params.id }, { $pull: { reportsTo: req.params.id } });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;