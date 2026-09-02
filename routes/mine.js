const express = require('express');
const router = express.Router();
const Mine = require('../models/Mine');
const User = require('../models/User');
const Compliance = require('../models/Compliance');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/mines — admin sees all, others see only their own
router.get('/', protect, async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin' ? {} : { _id: req.user.mine };
    const mines = await Mine.find(filter).sort({ name: 1 });
    res.json(mines);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/mines/:id
router.get('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user.mine) !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const mine = await Mine.findById(req.params.id);
    if (!mine) return res.status(404).json({ message: 'Mine not found' });
    res.json(mine);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/mines
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const mine = await Mine.create(req.body);
    res.status(201).json(mine);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/mines/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const mine = await Mine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!mine) return res.status(404).json({ message: 'Mine not found' });
    res.json(mine);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/mines/:id — blocked if users or compliances still attached
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [users, compliances] = await Promise.all([
      User.countDocuments({ mine: req.params.id }),
      Compliance.countDocuments({ mine: req.params.id }),
    ]);
    if (users || compliances) {
      return res.status(400).json({
        message: `Cannot delete: ${users} user(s) and ${compliances} compliance(s) are linked to this mine. Deactivate it instead.`,
      });
    }
    await Mine.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mine deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
