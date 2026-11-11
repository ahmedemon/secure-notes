const { HttpError } = require('./http');

// Strings only: rejects objects such as { "$gt": "" } (NoSQL operator injection)
function str(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  const v = value.trim();
  if (v.length < min || v.length > max)
    throw new HttpError(400, `${field} must be ${min}-${max} characters`);
  return v;
}

function email(value) {
  const v = str(value, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, 'email is invalid');
  return v;
}

function password(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'password must be a string');
  // bcrypt only uses the first 72 bytes
  if (value.length < 8 || Buffer.byteLength(value) > 72)
    throw new HttpError(400, 'password must be 8-72 bytes');
  return value;
}

function interests(value) {
  if (!Array.isArray(value) || value.length > 20)
    throw new HttpError(400, 'interests must be an array of up to 20 strings');
  const clean = value.map((i) => str(i, 'interest', { max: 40 }).toLowerCase());
  return [...new Set(clean)];
}

function role(value) {
  if (value !== 'user' && value !== 'admin') throw new HttpError(400, 'role must be user or admin');
  return value;
}

module.exports = { str, email, password, interests, role };
