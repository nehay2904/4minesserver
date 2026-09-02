const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, mine: user.mine },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const shape = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  mine: user.mine,
  dept: user.dept,
  designation: user.designation,
  reportsTo: user.reportsTo,
});

// POST /api/auth/register  (admin only — no open sign-up)
router.post('/register', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, mine, dept, designation, reportsTo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (role !== 'admin' && !mine) {
      return res.status(400).json({ message: 'Mine is required for supervisor and user roles' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      mine: role === 'admin' ? null : mine,
      dept: dept || '',
      designation: designation || '',
      reportsTo: reportsTo || null,
    });

    res.status(201).json(shape(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() }).populate(
      'mine',
      'name code type'
    );

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    res.json({ ...shape(user), token: generateToken(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('mine', 'name code type')
    .populate('reportsTo', 'name email role');
  res.json(user);
});

module.exports = router;
