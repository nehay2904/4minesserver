require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// ---- edit these three ----
const NAME = 'Neha Suresh Yednurwar';
const EMAIL = 'neha.yednurwar@jindalpower.com';
const PASSWORD = 'S#27nm12@';
// --------------------------

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const exists = await User.findOne({ email: EMAIL.toLowerCase() });
    if (exists) {
      console.log('An account with that email already exists.');
      process.exit(0);
    }
    await User.create({
      name: NAME,
      email: EMAIL,
      password: PASSWORD, // hashed automatically by the model
      role: 'admin',
      mine: null,
    });
    console.log('✅ Admin created:', EMAIL);
    console.log('Log in, then delete this file.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();