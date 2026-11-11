const router = require('express').Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { HttpError, wrap, isId } = require('../utils/http');
const { getPage, meta } = require('../utils/pagination');
const v = require('../utils/validate');

// Posts are visible to everyone (no auth needed to read)

// Public feed, newest first (default _id index)
router.get(
  '/',
  wrap(async (req, res) => {
    const { page, limit, skip } = getPage(req.query);
    const [posts, total] = await Promise.all([
      Post.find().sort({ _id: -1 }).skip(skip).limit(limit).populate('author', 'name'),
      Post.estimatedDocumentCount(),
    ]);
    res.json({ data: posts, meta: meta(page, limit, total) });
  })
);

/*
 * AGGREGATION SCENARIO 2 - all posts of a particular user
 * ONE aggregation pipeline with a $lookup stage.
 *  - $match on _id uses the default _id index.
 *  - $lookup joins posts.author -> users._id using the { author: 1, _id: -1 } index; the
 *    sub-pipeline sorts newest-first and paginates (limit + 1 tells us if there is a next page).
 *  - Only public fields are returned (name + posts).
 * Needs MongoDB 5.0+ (localField/foreignField combined with a sub-pipeline).
 */
router.get(
  '/user/:userId',
  wrap(async (req, res) => {
    if (!isId(req.params.userId)) throw new HttpError(400, 'Invalid id');
    const { page, limit, skip } = getPage(req.query);

    const [result] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.userId) } },
      {
        $lookup: {
          from: Post.collection.name,
          localField: '_id',
          foreignField: 'author',
          pipeline: [
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit + 1 },
            { $project: { title: 1, content: 1, createdAt: 1 } },
          ],
          as: 'posts',
        },
      },
      { $project: { name: 1, posts: 1 } },
    ]);

    if (!result) throw new HttpError(404, 'User not found');
    const hasNext = result.posts.length > limit;
    res.json({
      user: { _id: result._id, name: result.name },
      posts: result.posts.slice(0, limit),
      meta: { page, limit, hasNext },
    });
  })
);

router.post(
  '/',
  authenticate,
  wrap(async (req, res) => {
    const post = await Post.create({
      author: req.user._id,
      title: v.str(req.body.title, 'title', { max: 200 }),
      content: v.str(req.body.content, 'content', { max: 20000 }),
    });
    res.status(201).json({ post });
  })
);

module.exports = router;
