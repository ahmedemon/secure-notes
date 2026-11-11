const { Schema, model } = require('mongoose');

const noteSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 20000 },
  },
  { timestamps: true, versionKey: false }
);

/*
 * INDEX
 * { owner: 1, _id: -1 } serves:
 *   - a user listing their notes (equality on owner + newest-first sort, no in-memory sort)
 *   - an admin listing one user's notes (?owner=...)
 *   - countDocuments({ owner }) for pagination totals
 *   - cascade delete when a user is removed (deleteMany({ owner }))
 *
 * Reading one note (GET /notes/:id) uses the default _id index.
 * The admin "all notes" list is sorted by _id desc and also uses the default _id index.
 */
noteSchema.index({ owner: 1, _id: -1 });

module.exports = model('Note', noteSchema);
