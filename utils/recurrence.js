// utils/recurrence.js
// Helpers for rolling recurring returns forward to their next cycle.

// Add N calendar months to a date, clamping the day to the month's last day
// (so 31 Jan + 1 month -> 28/29 Feb, and the 10th stays the 10th).
function addMonthsSafe(date, months) {
  const dt = new Date(date);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)
  ).getUTCDate();
  dt.setUTCDate(Math.min(day, lastDay));
  return dt;
}

// Next due date for a recurring return. Rolls at least one interval forward,
// and keeps rolling if the result is still in the past (missed cycles),
// so the new due date is always the next upcoming one.
function computeNextDueDate(currentDue, recurrenceMonths, from = new Date()) {
  if (!currentDue || !recurrenceMonths) return currentDue;
  let next = addMonthsSafe(currentDue, recurrenceMonths);
  while (next < from) {
    next = addMonthsSafe(next, recurrenceMonths);
  }
  return next;
}

// Fallback: derive the interval from the frequency text for returns created
// manually (the import JSON already carries recurrenceMonths explicitly).
function deriveRecurrenceMonths(frequency, subCategory) {
  if (subCategory !== 'Return') return null;
  const f = (frequency || '').toLowerCase();
  if (f.includes('quarter')) return 3;
  if (f.includes('half') || (f.includes('june') && f.includes('december'))) return 6;
  if (f.includes('month')) return 1;
  if (f.includes('annual') || f.includes('year') || f.includes('february')) return 12;
  return null;
}

module.exports = { addMonthsSafe, computeNextDueDate, deriveRecurrenceMonths };