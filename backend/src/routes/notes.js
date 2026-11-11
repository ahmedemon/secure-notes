const router = require('express').Router();
const Note = require('../models/Note');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, wrap, validId, isId } = require('../utils/http');
const { getPage, meta } = require('../utils/pagination');
const v = require('../utils/validate');

router.use(authenticate);
router.param('id', validId);

const noteBody = (body, partial) => {
  const out = {};
  if (!partial || body.title !== undefined) out.title = v.str(body.title, 'title', { max: 200 });
  if (body.content !== undefined) out.content = v.str(body.content, 'content', { min: 0, max: 20000 });
  return out;
};

// My notes (users and admins alike) - { owner, _id } index
router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, skip } = getPage(req.query);
    const filter = { owner: req.user._id };
    const [notes, total] = await Promise.all([
      Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
      Note.countDocuments(filter),
    ]);
    res.json({ data: notes, meta: meta(page, limit, total) });
  })
);

// Admin: everyone's notes, optionally filtered by ?owner=<userId>
router.get(
  '/all',
  requireRole('admin'),
  wrap(async (req, res) => {
    const { page, limit, skip } = getPage(req.query);
    const filter = {};
    if (req.query.owner !== undefined) {
      if (!isId(req.query.owner)) throw new HttpError(400, 'Invalid owner id');
      filter.owner = req.query.owner;
    }
    const [notes, total] = await Promise.all([
      Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).populate('owner', 'name email'),
      Object.keys(filter).length ? Note.countDocuments(filter) : Note.estimatedDocumentCount(),
    ]);
    res.json({ data: notes, meta: meta(page, limit, total) });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const note = await Note.create({ ...noteBody(req.body, false), owner: req.user._id });
    res.status(201).json({ note });
  })
);

// Owner or admin can read a note (_id index)
router.get(
  '/:id',
  wrap(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (!note || (req.user.role !== 'admin' && !note.owner.equals(req.user._id)))
      throw new HttpError(404, 'Note not found');
    res.json({ note });
  })
);

// Only the owner can modify / delete (admins inherit user rights over THEIR OWN notes)
router.patch(
  '/:id',
  wrap(async (req, res) => {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      noteBody(req.body, true),
      { new: true, runValidators: true }
    );
    if (!note) throw new HttpError(404, 'Note not found');
    res.json({ note });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    const note = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!note) throw new HttpError(404, 'Note not found');
    res.status(204).end();
  })
);

module.exports = router;
