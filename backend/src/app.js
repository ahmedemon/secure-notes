const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // running behind a proxy (Render) -> correct client IPs for rate limiting

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Frontend origin(s) allowed to call this API (comma-separated, no trailing slash)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ status: 'ok', service: 'secure-notes-api' })); // health check

// Brute-force protection on login/register only
app.use(
  ['/api/auth/login', '/api/auth/register'],
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/posts', require('./routes/posts'));

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' });
  if (err.code === 11000) return res.status(409).json({ message: 'Email already in use' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid value' });
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
