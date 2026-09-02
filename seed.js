const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Mine = require('./models/Mine');
const User = require('./models/User');

const MINES = [
  { name: 'Gare Palma IV/1', code: 'GPIV1', type: 'working', location: 'Raigarh, Chhattisgarh' },
  { name: 'Gare Palma IV/2 & IV/3', code: 'GPIV23', type: 'working', location: 'Raigarh, Chhattisgarh' },
  { name: 'Gare Palma Sector 1', code: 'GPS1', type: 'greenfield', location: 'Raigarh, Chhattisgarh' },
  { name: 'Banai & Bhalumunda', code: 'BNBH', type: 'greenfield', location: 'Chhattisgarh' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  for (const m of MINES) {
    const mine = await Mine.findOneAndUpdate({ code: m.code }, m, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log(`Mine ready: ${mine.code} — ${mine.name}`);
  }

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Admin already exists: ${email}`);
    } else {
      await User.create({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email,
        password,
        role: 'admin',
        mine: null,
      });
      console.log(`Admin created: ${email}`);
    }
  } else {
    console.log('Skipped admin creation — set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  }

  await mongoose.disconnect();
  console.log('Seed complete');
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
