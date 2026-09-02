/**
 * One-time bulk import of all users.
 *
 *   node importUsers.js
 *
 * - Looks up mine _id by code automatically
 * - Sets reportsTo chain correctly
 * - Safe to re-run: skips existing emails
 *
 * Requires mines to exist first (node seed.js)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Mine = require('./models/Mine');

const PASSWORD = 'Jindal@123';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Fetch mine IDs by code
    const mines = await Mine.find().select('code');
    const m = {};
    mines.forEach((mine) => (m[mine.code] = mine._id));

    if (!m.GPIV1 || !m.GPIV23 || !m.GPS1 || !m.BNBH) {
      console.error('Mines not found. Run "node seed.js" first.');
      process.exit(1);
    }

    // ── STEP 1: Create Team Leads first (no reportsTo) ──────────────────
    const supervisors = [
      // GP IV/1
      {
        name: 'Vijay Jain',
        email: 'vijay.jain@jindalpower.com',
        role: 'supervisor',
        mine: m.GPIV1,
        designation: 'Agent',
        dept: '',
      },
      {
        name: 'SK Choudhary',
        email: 'sk.choudhary@jindalpower.com',
        role: 'supervisor',
        mine: m.GPIV1,
        designation: 'Manager',
        dept: '',
      },
      // GP IV/2&3
      {
        name: 'Govind Kumar',
        email: 'govind.kumar@jindalpower.com',
        role: 'supervisor',
        mine: m.GPIV23,
        designation: 'Agent',
        dept: '',
      },
      {
        name: 'S.K. Dubey',
        email: 'sanjeev.dubey@jindalpower.com',
        role: 'supervisor',
        mine: m.GPIV23,
        designation: 'Manager',
        dept: '',
      },
      // GP Sector 1
      {
        name: 'Rajesh Dubey',
        email: 'rajesh.dubey@jindalpower.com',
        role: 'supervisor',
        mine: m.GPS1,
        designation: 'Agent',
        dept: '',
      },
      // Banai & Bhalumuda
      {
        name: 'SC Pal',
        email: 'suresh.pal@jindalpower.com',
        role: 'supervisor',
        mine: m.BNBH,
        designation: 'Senior Geologist',
        dept: '',
      },
    ];

    const supIds = {}; // name -> _id
    for (const s of supervisors) {
      let u = await User.findOne({ email: s.email });
      if (u) {
        console.log(`Skipped (exists): ${s.email}`);
      } else {
        u = await User.create({ ...s, password: PASSWORD });
        console.log(`Created supervisor: ${s.name} (${s.email})`);
      }
      supIds[s.name] = u._id;
    }

    // ── STEP 2: Create Users, reportsTo = their Agent ───────────────────
    const users = [
      // GP IV/1 — all report to Vijay Jain (Agent)
      {
        name: 'Ashish Kant',
        email: 'ashish.kant@jindalpower.com',
        role: 'user',
        mine: m.GPIV1,
        dept: 'Safety',
        designation: '1st Authority',
        reportsTo: supIds['Vijay Jain'],
      },
      {
        name: 'Mangal Mandal',
        email: 'mangal.mandal@jindalpower.com',
        role: 'user',
        mine: m.GPIV1,
        dept: 'Explosive',
        designation: '1st Authority',
        reportsTo: supIds['Vijay Jain'],
      },
      {
        name: 'Mayoor Paliwal',
        email: 'mayoor.paliwal@jindalpower.com',
        role: 'user',
        mine: m.GPIV1,
        dept: 'Mining',
        designation: '1st Authority',
        reportsTo: supIds['Vijay Jain'],
      },
      {
        name: 'Sudhir Rai',
        email: 'sudhir.rai@jindalpower.com',
        role: 'user',
        mine: m.GPIV1,
        dept: 'Labour / HR',
        designation: '1st Authority',
        reportsTo: supIds['Vijay Jain'],
      },
      {
        name: 'Mohd Irfan',
        email: 'irfan.alam@jindalpower.com',
        role: 'user',
        mine: m.GPIV1,
        dept: 'Electrical',
        designation: '1st Authority',
        reportsTo: supIds['Vijay Jain'],
      },

      // GP IV/2&3 — all report to Govind Kumar (Agent)
      {
        name: 'Sanjay Sharma',
        email: 'ssharma@jindalpower.com',
        role: 'user',
        mine: m.GPIV23,
        dept: 'Safety',
        designation: '1st Authority',
        reportsTo: supIds['Govind Kumar'],
      },
      {
        name: 'Shailesh Roy',
        email: 'shailesh.roy@jindalpower.com',
        role: 'user',
        mine: m.GPIV23,
        dept: 'Explosive',
        designation: '1st Authority',
        reportsTo: supIds['Govind Kumar'],
      },
      {
        name: 'Nilesh Yadav',
        email: 'nilesh@jindalpower.com',
        role: 'user',
        mine: m.GPIV23,
        dept: 'Electrical',
        designation: '1st Authority',
        reportsTo: supIds['Govind Kumar'],
      },
      {
        name: 'Kedar Pradhan',
        email: 'kedar.pradhan@jindalpower.com',
        role: 'user',
        mine: m.GPIV23,
        dept: 'Mining',
        designation: '1st Authority',
        reportsTo: supIds['Govind Kumar'],
      },

      // GP Sector 1 — report to Rajesh Dubey (Agent)
      {
        name: 'Anwesha Singh',
        email: 'anwesha.singh@jindalpower.com',
        role: 'user',
        mine: m.GPS1,
        dept: 'Environment & Forest',
        designation: '1st Authority',
        reportsTo: supIds['Rajesh Dubey'],
      },
      {
        name: 'Hansraj Sharma',
        email: 'hanshraj.sharma@jindalpower.com',
        role: 'user',
        mine: m.GPS1,
        dept: 'Mining',
        designation: '1st Authority',
        reportsTo: supIds['Rajesh Dubey'],
      },

      // Banai — report to SC Pal
      {
        name: 'Subodh Kumar',
        email: 'subodh.singh@jindalpower.com',
        role: 'user',
        mine: m.BNBH,
        dept: 'Mining',
        designation: '1st Authority',
        reportsTo: supIds['SC Pal'],
      },
    ];

    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        console.log(`Skipped (exists): ${u.email}`);
        continue;
      }
      await User.create({ ...u, password: PASSWORD });
      console.log(`Created user: ${u.name} (${u.email})`);
    }

    console.log('\n✅ All users imported. Password for everyone: Jindal@123');
    console.log('Ask each person to change their password after first login.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
})();