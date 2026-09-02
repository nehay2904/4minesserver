const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) throw new Error('No recipients');

  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: recipients.join(','),
    subject,
    html,
  });
};

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';

const complianceTemplate = ({ heading, note, compliance, mineName, ownerName }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <h2 style="color:#166534;margin-bottom:4px;">${heading}</h2>
    <p style="margin-top:0;color:#4b5563;">${note}</p>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
      <tr><td><b>Mine</b></td><td>${mineName || '-'}</td></tr>
      <tr><td><b>Compliance ID</b></td><td>${compliance.complianceId}</td></tr>
      <tr><td><b>Title</b></td><td>${compliance.title}</td></tr>
      <tr><td><b>Category</b></td><td>${compliance.category} / ${compliance.subCategory || '-'}</td></tr>
      <tr><td><b>Act / Ref</b></td><td>${compliance.act || '-'} ${compliance.regulationRef || ''}</td></tr>
      <tr><td><b>Form No.</b></td><td>${compliance.formNo || '-'}</td></tr>
      <tr><td><b>Frequency</b></td><td>${compliance.frequency || '-'}</td></tr>
      <tr><td><b>Due Date</b></td><td>${fmt(compliance.dueDate)}</td></tr>
      <tr><td><b>Responsible</b></td><td>${ownerName || '-'}</td></tr>
    </table>
    <p style="font-size:12px;color:#6b7280;margin-top:16px;">
      This is an automated message from CompliTrack — JPL Mines.
    </p>
  </div>
`;

module.exports = { sendMail, complianceTemplate, fmt };
