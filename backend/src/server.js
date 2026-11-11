require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set (32+ characters). See .env.example');
  process.exit(1);
}

const app = require('./app');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secure_notes');
  // Make sure the schema.index() definitions are built before serving traffic
  await Promise.all([User.init(), Note.init(), Post.init()]);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
