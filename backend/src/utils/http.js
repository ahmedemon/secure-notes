class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// router.param handler: rejects malformed ids before they reach Mongo
const validId = (req, res, next, id) =>
  OBJECT_ID.test(id) ? next() : next(new HttpError(400, 'Invalid id'));

const isId = (v) => typeof v === 'string' && OBJECT_ID.test(v);

module.exports = { HttpError, wrap, validId, isId };
