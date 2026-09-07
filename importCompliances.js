/**
 * FINAL compliance import — mines + auto-assigned users by department.
 *
 *   node importCompliances.js
 *
 * Deletes all existing compliances, then imports 139 unique items.
 * Each compliance is linked to its correct mine(s) AND assigned to the
 * right person(s) based on category -> department -> authority matrix.
 *
 * Assignment logic:
 *   GP IV/1:   Safety->Ashish, Explosive->Mangal, Environment->Mayoor,
 *              Labour/HR->Sudhir, Electrical->Irfan, Mining->Mayoor
 *   GP IV/2&3: Safety->Sanjay, Explosive->Shailesh, Electrical->Nilesh,
 *              Mining->Kedar
 *   GP Sector 1: ALL -> Rajesh Dubey (Team Lead)
 *   Banai:       ALL -> SC Pal (Team Lead)
 *
 * Run: node seed.js -> node importUsers.js -> node importCompliances.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Mine = require('./models/Mine');
const User = require('./models/User');
const Compliance = require('./models/Compliance');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Build mine code -> _id
    const mines = await Mine.find().select('code');
    const mineByCode = {};
    mines.forEach((m) => (mineByCode[m.code] = m._id));

    const required = ['GPIV1', 'GPIV23', 'GPS1', 'BNBH'];
    const missing = required.filter((c) => !mineByCode[c]);
    if (missing.length) {
      console.error('Missing mines: ' + missing.join(', ') + ' -- run node seed.js');
      process.exit(1);
    }

    // Build email -> _id
    const users = await User.find().select('email');
    const userByEmail = {};
    users.forEach((u) => (userByEmail[u.email.toLowerCase()] = u._id));

    // Wipe existing
    const deleted = await Compliance.deleteMany({});
    console.log('Cleared ' + deleted.deletedCount + ' existing compliances');

    // Load JSON
    const raw = fs.readFileSync(path.join(__dirname, 'compliances_final.json'), 'utf-8');
    const items = JSON.parse(raw);
    console.log('Loaded ' + items.length + ' compliances from JSON');

    let inserted = 0;
    let assignedCount = 0;
    let unassignedCount = 0;

    for (const it of items) {
      const { mines: mineCodes, assignedEmails, ...rest } = it;

      // Resolve mine codes -> ObjectIds
      const mineIds = mineCodes
        .map((c) => mineByCode[c])
        .filter(Boolean);

      // Resolve emails -> user ObjectIds
      const userIds = (assignedEmails || [])
        .map((e) => userByEmail[e.toLowerCase()])
        .filter(Boolean);

      await Compliance.create({
        ...rest,
        mines: mineIds,
        assignedTo: userIds,
      });

      inserted++;
      if (userIds.length) assignedCount++;
      else unassignedCount++;
    }

    console.log('\nDone.');
    console.log('  Inserted: ' + inserted);
    console.log('  Auto-assigned: ' + assignedCount);
    console.log('  Unassigned: ' + unassignedCount);
    console.log('\nAll compliances linked to mines and assigned to users.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
})();