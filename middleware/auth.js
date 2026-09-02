const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Restrict a route to given roles: allow('admin'), allow('admin','supervisor')
const allow = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Access denied' });
};

const adminOnly = allow('admin');

/**
 * Build a mongo filter that limits results to what the caller may see.
 *  admin      -> everything (optionally filtered by ?mine=)
 *  supervisor -> only their own mine
 *  user       -> only their own mine (routes further narrow to assignedTo)
 */
const mineScope = (req) => {
  if (req.user.role === 'admin') {
    return req.query.mine ? { mine: req.query.mine } : {};
  }
  return { mine: req.user.mine };
};

module.exports = { protect, allow, adminOnly, mineScope };
