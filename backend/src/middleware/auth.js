const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError, wrap } = require('../utils/http');

const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });

// Verifies the bearer token, then loads the user fresh (by _id index) so that
// deleted users or role changes take effect immediately.
const authenticate = wrap(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub).select('name email role');
  if (!user) throw new HttpError(401, 'Account no longer exists');
  req.user = user;
  next();
});

const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));

module.exports = { signToken, authenticate, requireRole };
