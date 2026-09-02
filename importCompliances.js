/**
 * Bulk import — deduplicated compliances with mines[] array.
 *
 *   node importCompliances.js
 *
 * - Deletes all existing compliances first (fresh import)
 * - Each compliance has a mines[] array (multiple mines per record)
 * - 139 unique records instead of 280 duplicates
 *
 * Run order: node seed.js → node importUsers.js → node importCompliances.js
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const mongoose   = require('mongoose');
const Mine       = require('./models/Mine');
const Compliance = require('./models/Compliance');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Build code -> _id map
    const mines = await Mine.find().select('code');
    const mineByCode = {};
    mines.forEach((m) => (mineByCode[m.code] = m._id));

    const required = ['GPIV1', 'GPIV23', 'GPS1', 'BNBH'];
    const missing = required.filter((c) => !mineByCode[c]);
    if (missing.length) {
      console.error(`Missing mines in DB: ${missing.join(', ')} — run node seed.js first`);
      process.exit(1);
    }

    // Fresh import — wipe existing
    const deleted = await Compliance.deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} existing compliances`);

    const raw   = fs.readFileSync(path.join(__dirname, 'compliances_v2.json'), 'utf-8');
    const items = JSON.parse(raw);
    console.log(`Loaded ${items.length} unique compliances from JSON`);

    let inserted = 0;
    for (const it of items) {
      const { mines: mineCodes, ...rest } = it;
      const mineIds = mineCodes.map((c) => mineByCode[c]).filter(Boolean);
      await Compliance.create({ ...rest, mines: mineIds });
      inserted++;
    }

    console.log(`\n✅ Inserted ${inserted} compliances`);
    console.log('Each compliance is now linked to its correct mine(s).');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
})();