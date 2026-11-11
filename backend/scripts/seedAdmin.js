require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

(async () => {
  const { ADMIN_NAME = 'Admin', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secure_notes');
  await User.init();
  const email = ADMIN_EMAIL.toLowerCase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email },
    { $set: { name: ADMIN_NAME, password, role: 'admin' } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin ready: ${email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
