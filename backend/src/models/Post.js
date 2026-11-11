const { Schema, model } = require('mongoose');

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
  },
  { timestamps: true, versionKey: false }
);

/*
 * INDEX
 * { author: 1, _id: -1 } serves:
 *   - the $lookup join in Aggregation Scenario 2 (foreignField: 'author')
 *     together with the newest-first $sort inside the $lookup sub-pipeline
 *   - cascade delete when a user is removed
 *
 * The public feed (all posts, newest first) uses the default _id index.
 */
postSchema.index({ author: 1, _id: -1 });

module.exports = model('Post', postSchema);
