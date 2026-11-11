const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, wrap, validId } = require('../utils/http');
const { getPage, meta } = require('../utils/pagination');
const v = require('../utils/validate');

// Everything here is admin-only
router.use(authenticate, requireRole('admin'));
router.param('id', validId);

// List users (paginated, newest first -> default _id index)
router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, skip } = getPage(req.query);
    const [users, total] = await Promise.all([
      User.find().sort({ _id: -1 }).skip(skip).limit(limit),
      User.estimatedDocumentCount(),
    ]);
    res.json({ data: users, meta: meta(page, limit, total) });
  })
);

/*
 * AGGREGATION SCENARIO 1 - users grouped by interests
 * Exactly ONE User.aggregate() call. Optional ?interest=chess narrows to one group.
 * The first $match hits the multikey { interests: 1 } index.
 * $facet gives paginated groups + total group count in the same single call.
 */
router.get(
  '/groups/interests',
  wrap(async (req, res) => {
    const { page, limit, skip } = getPage(req.query);
    const interest =
      req.query.interest === undefined ? null : v.str(req.query.interest, 'interest', { max: 40 }).toLowerCase();

    const pipeline = [
      { $match: interest ? { interests: interest } : { interests: { $exists: true } } },
      { $unwind: '$interests' },
      ...(interest ? [{ $match: { interests: interest } }] : []),
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 },
          users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [result] = await User.aggregate(pipeline);
    const total = result.total[0]?.n || 0;
    const data = result.data.map((g) => ({ interest: g._id, count: g.count, users: g.users }));
    res.json({ data, meta: meta(page, limit, total) });
  })
);

router.post(
  '/',
  wrap(async (req, res) => {
    const { name, email, password, role, interests } = req.body;
    const user = await User.create({
      name: v.str(name, 'name', { max: 100 }),
      email: v.email(email),
      password: await bcrypt.hash(v.password(password), 12),
      role: role === undefined ? 'user' : v.role(role),
      interests: interests === undefined ? [] : v.interests(interests),
    });
    res.status(201).json({ user });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id); // _id index
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user });
  })
);

router.patch(
  '/:id',
  wrap(async (req, res) => {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) throw new HttpError(404, 'User not found');

    const { name, email, password, role, interests } = req.body;
    if (name !== undefined) user.name = v.str(name, 'name', { max: 100 });
    if (email !== undefined) user.email = v.email(email);
    if (interests !== undefined) user.interests = v.interests(interests);
    if (password !== undefined) user.password = await bcrypt.hash(v.password(password), 12);
    if (role !== undefined) {
      if (user.id === req.user.id && role !== user.role)
        throw new HttpError(400, 'You cannot change your own role');
      user.role = v.role(role);
    }
    await user.save();
    res.json({ user });
  })
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot delete yourself');
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    // Cascade (both use the { owner/author, _id } indexes)
    await Promise.all([Note.deleteMany({ owner: user._id }), Post.deleteMany({ author: user._id })]);
    res.status(204).end();
  })
);

module.exports = router;
