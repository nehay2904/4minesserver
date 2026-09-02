const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema(
  {
    compliance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Compliance',
      required: true,
    },
    complianceTitle: { type: String },
    mine: { type: mongoose.Schema.Types.ObjectId, ref: 'Mine', index: true },
    // Person the compliance belongs to
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    alertType: {
      type: String,
      enum: ['reminder', 'escalation-supervisor', 'escalation-admin'],
      required: true,
    },
    sentTo: [{ type: String }],
    sentAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      default: 'sent',
    },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlertLog', alertLogSchema);
