const cron = require('node-cron');
const Compliance = require('../models/Compliance');
const User = require('../models/User');
const AlertLog = require('../models/AlertLog');
const { sendMail, complianceTemplate } = require('./mailer');

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysOverdue = (dueDate) =>
  Math.floor((startOfDay(new Date()) - startOfDay(dueDate)) / DAY);

const log = async (entry) => {
  try {
    await AlertLog.create(entry);
  } catch (e) {
    console.error('AlertLog write failed:', e.message);
  }
};

const dispatch = async ({ compliance, to, alertType, heading, note }) => {
  const ownerName = compliance.assignedTo ? compliance.assignedTo.name : '-';
  const mineName = compliance.mine ? compliance.mine.name : '-';
  const base = {
    compliance: compliance._id,
    complianceTitle: compliance.title,
    mine: compliance.mine ? compliance.mine._id : null,
    user: compliance.assignedTo ? compliance.assignedTo._id : null,
    alertType,
    sentTo: to,
  };

  try {
    await sendMail({
      to,
      subject: `[CompliTrack] ${heading} — ${compliance.title}`,
      html: complianceTemplate({ heading, note, compliance, mineName, ownerName }),
    });
    await log({ ...base, status: 'sent' });
    console.log(`${alertType} sent for ${compliance.complianceId} -> ${to.join(', ')}`);
  } catch (err) {
    await log({ ...base, status: 'failed', error: err.message });
    console.error(`${alertType} FAILED for ${compliance.complianceId}:`, err.message);
  }
};

/** Recompute Upcoming / Due This Month / Overdue for all open compliances. */
const refreshStatuses = async () => {
  const today = startOfDay(new Date());
  const open = await Compliance.find({
    status: { $ne: 'Completed' },
    dueDate: { $ne: null },
  });

  for (const c of open) {
    const due = startOfDay(c.dueDate);
    let status;
    if (due < today) status = 'Overdue';
    else if (
      due.getMonth() === today.getMonth() &&
      due.getFullYear() === today.getFullYear()
    )
      status = 'Due This Month';
    else status = 'Upcoming';

    if (c.status !== status) {
      c.status = status;
      await c.save();
    }
  }
};

/**
 * Escalation timeline:
 *   due date        -> reminder to assigned user
 *   +1 day overdue  -> escalate to that user's supervisor (reportsTo)
 *   +3 days overdue -> escalate to admin(s)
 */
const runAlerts = async () => {
  const today = startOfDay(new Date());

  const items = await Compliance.find({
    status: { $ne: 'Completed' },
    dueDate: { $ne: null, $lte: new Date() },
    assignedTo: { $ne: null },
  })
    .populate('assignedTo', 'name email reportsTo')
    .populate('mine', 'name code');

  const admins = await User.find({ role: 'admin', isActive: true }).select('email');
  const adminEmails = admins.map((a) => a.email);

  for (const c of items) {
    const overdue = daysOverdue(c.dueDate);
    const owner = c.assignedTo;
    if (!owner) continue;

    // Day 0 — reminder to the responsible user
    if (overdue === 0 && !c.lastReminderAt) {
      await dispatch({
        compliance: c,
        to: [owner.email],
        alertType: 'reminder',
        heading: 'Compliance Due Today',
        note: 'This compliance is due today. Please complete it and upload the proof in CompliTrack.',
      });
      c.lastReminderAt = today;
      await c.save();
    }

    // +1 day — escalate to supervisor
    if (overdue >= 1 && !c.supervisorEscalatedAt) {
      const supervisor = owner.reportsTo
        ? await User.findById(owner.reportsTo).select('name email isActive')
        : null;
      if (supervisor && supervisor.isActive) {
        await dispatch({
          compliance: c,
          to: [supervisor.email],
          alertType: 'escalation-supervisor',
          heading: `Overdue Compliance — ${overdue} day(s)`,
          note: `${owner.name} has not completed this compliance. It is now ${overdue} day(s) overdue.`,
        });
      }
      c.supervisorEscalatedAt = new Date();
      await c.save();
    }

    // +3 days — escalate to admin
    if (overdue >= 3 && !c.adminEscalatedAt && adminEmails.length) {
      await dispatch({
        compliance: c,
        to: adminEmails,
        alertType: 'escalation-admin',
        heading: `Critical Overdue — ${overdue} day(s)`,
        note: `This compliance assigned to ${owner.name} remains open ${overdue} day(s) past its due date and has already been escalated to the supervisor.`,
      });
      c.adminEscalatedAt = new Date();
      await c.save();
    }
  }
};

const runDaily = async () => {
  console.log('[scheduler] daily run started');
  try {
    await refreshStatuses();
    await runAlerts();
    console.log('[scheduler] daily run complete');
  } catch (err) {
    console.error('[scheduler] run failed:', err.message);
  }
};

// 10:00 AM IST every day
cron.schedule(process.env.CRON_EXPR || '0 10 * * *', runDaily, {
  timezone: 'Asia/Kolkata',
});

console.log('[scheduler] registered — daily 10:00 IST');

module.exports = { runDaily, refreshStatuses, runAlerts };
