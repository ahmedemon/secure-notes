const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/*
 * INDEXES (only what the queries actually need)
 *
 * 1. { email: 1 } unique  -> login lookup (findOne by email) + email uniqueness.
 * 2. { interests: 1 }     -> multikey index; Aggregation Scenario 1 starts with a $match
 *                            on `interests` (optionally a single interest), so it is index-backed.
 *
 * NOT indexed on purpose:
 *  - "get user by id / profile"  -> served by the default _id index.
 *  - "admin lists users"         -> sorted by _id desc (ObjectId is time-ordered), which uses
 *                                   the default _id index, so no createdAt index is needed.
 */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ interests: 1 });

module.exports = model('User', userSchema);
