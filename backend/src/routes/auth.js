const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken, authenticate } = require('../middleware/auth');
const { HttpError, wrap } = require('../utils/http');
const v = require('../utils/validate');

const BCRYPT_COST = 12;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);

// Public registration always creates a regular "user". Admins are seeded or created by another admin.
router.post(
  '/register',
  wrap(async (req, res) => {
    const { name, email, password, interests } = req.body;
    const user = await User.create({
      name: v.str(name, 'name', { max: 100 }),
      email: v.email(email),
      password: await bcrypt.hash(v.password(password), BCRYPT_COST),
      interests: interests === undefined ? [] : v.interests(interests),
    });
    res.status(201).json({ token: signToken(user._id), user });
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const email = v.email(req.body.email);
    if (typeof req.body.password !== 'string') throw new HttpError(400, 'password must be a string');

    const user = await User.findOne({ email }).select('+password'); // { email } unique index
    const ok = await bcrypt.compare(req.body.password, user ? user.password : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

    res.json({ token: signToken(user._id), user });
  })
);

router.get(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    res.json({ user: await User.findById(req.user._id) }); // _id index
  })
);

// Users can update their own name / interests / password (not role or email)
router.patch(
  '/me',
  authenticate,
  wrap(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    const { name, interests, password } = req.body;
    if (name !== undefined) user.name = v.str(name, 'name', { max: 100 });
    if (interests !== undefined) user.interests = v.interests(interests);
    if (password !== undefined) user.password = await bcrypt.hash(v.password(password), BCRYPT_COST);
    await user.save();
    res.json({ user });
  })
);

module.exports = router;
