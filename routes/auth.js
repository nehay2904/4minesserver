const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).populate('mine', 'name code type');
    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      token: signToken(user._id),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mine: user.mine,
      dept: user.dept,
      designation: user.designation,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register — admin only
router.post('/register', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, mine, dept, designation, reportsTo } = req.body;

    const exists = await User.findOne({ email: email?.toLowerCase() });
    if (exists)
      return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      mine: role === 'admin' ? null : mine,
      dept,
      designation,
      reportsTo: reportsTo || null,
    });

    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('mine', 'name code type');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;