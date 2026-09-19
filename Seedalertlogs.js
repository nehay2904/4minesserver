/**
 * One-off script to backfill AlertLog entries.
 * Run from the project root: node scripts/seedAlertLogs.js
 * Requires the same .env (MONGO_URI) your server already uses.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Compliance = require('../models/Compliance');
const User = require('../models/User');
const AlertLog = require('../models/AlertLog');

const ENTRIES = [
  // Kedar Pradhan — 5 monthly compliances, reminder logged on the 7th of each month
  { complianceId: 'CCO-1', userEmail: 'kedar.pradhan@jindalpower.com', dates: ['2026-07-07', '2026-08-07', '2026-09-07'] },
  { complianceId: 'CCO-2', userEmail: 'kedar.pradhan@jindalpower.com', dates: ['2026-07-07', '2026-08-07', '2026-09-07'] },
  { complianceId: 'CCO-3', userEmail: 'kedar.pradhan@jindalpower.com', dates: ['2026-07-07', '2026-08-07', '2026-09-07'] },
  { complianceId: 'CCO-4', userEmail: 'kedar.pradhan@jindalpower.com', dates: ['2026-07-07', '2026-08-07', '2026-09-07'] },
  { complianceId: 'CCO-5', userEmail: 'kedar.pradhan@jindalpower.com', dates: ['2026-07-07', '2026-08-07', '2026-09-07'] },

  // Arvind Sharma — half-yearly return
  { complianceId: 'SAF-40', userEmail: 'arvind.sharma1@jindalpower.com', dates: ['2026-07-23'] },

  // Saurabh Pandey — both blasting quarterly returns
  { complianceId: 'BLA-27', userEmail: 'saurabh.pandey@jindalpower.com', dates: ['2026-07-10'] },
  { complianceId: 'BLA-28', userEmail: 'saurabh.pandey@jindalpower.com', dates: ['2026-07-10'] },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  let created = 0, skipped = 0;

  for (const entry of ENTRIES) {
    const compliance = await Compliance.findOne({ complianceId: entry.complianceId });
    if (!compliance) {
      console.error(`✗ Compliance ${entry.complianceId} not found — skipping`);
      skipped += entry.dates.length;
      continue;
    }
    const user = await User.findOne({ email: entry.userEmail });
    if (!user) {
      console.error(`✗ User ${entry.userEmail} not found — skipping`);
      skipped += entry.dates.length;
      continue;
    }

    for (const dateStr of entry.dates) {
      await AlertLog.create({
        compliance: compliance._id,
        complianceTitle: compliance.title,
        mine: compliance.mines?.[0] || null,
        user: user._id,
        alertType: 'reminder',
        sentTo: [user.email],
        sentAt: new Date(dateStr),
        status: 'sent',
      });
      created++;
      console.log(`✓ Logged reminder for ${entry.complianceId} → ${user.email} on ${dateStr}`);
    }
  }

  await mongoose.disconnect();
  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});