const mongoose = require('mongoose');

const proofSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    filePath: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complianceSchema = new mongoose.Schema(
  {
    complianceId: { type: String, required: true, trim: true },
    mine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mine',
      required: true,
      index: true,
    },

    // Register columns
    category: {
      type: String,
      enum: [
        'DGMS',
        'PESO',
        'Central Electricity Authority',
        'Environment',
        'Labour',
        'HR & Establishment',
        'CCO / Ministry of Coal',
        'Ministry of Coal',
        'MoEF&CC / Environment',
        'CGPCB',
        'CGWA',
        'Forest Department',
        'District Administration / Gram Sabha',
        'State Mining Department',
      ],
      required: true,
    },
    subCategory: {
      type: String,
      enum: ['Notice', 'Return', 'Record', ''],
      default: '',
    },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    act: { type: String, default: '' },
    regulationRef: { type: String, default: '' },
    formNo: { type: String, default: '' },
    frequency: { type: String, default: '' },
    monitoringAuthority: { type: String, default: '' },
    signerRole: { type: String, default: '' },
    mode: { type: String, default: '' },
    remarks: { type: String, default: '' },

    // Greenfield sites use this; working mines default to 'Applicable Now'
    applicabilityStatus: {
      type: String,
      enum: [
        'Applicable Now',
        'In Progress / Disputed',
        'Not Applicable Yet',
        'Applicable at Commencement (not yet due)',
      ],
      default: 'Applicable Now',
    },

    // Assignment + tracking
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    alertDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Upcoming', 'Due This Month', 'Overdue', 'Completed'],
      default: 'Pending',
    },
    completedDate: { type: Date, default: null },
    proofs: [proofSchema],
    driveLink: { type: String, default: null },

    // Escalation bookkeeping (used by the scheduler so mails aren't re-sent)
    lastReminderAt: { type: Date, default: null },
    supervisorEscalatedAt: { type: Date, default: null },
    adminEscalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

complianceSchema.index({ mine: 1, complianceId: 1 }, { unique: true });
complianceSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Compliance', complianceSchema);
