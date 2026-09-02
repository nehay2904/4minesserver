const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'supervisor', 'user'],
      default: 'user',
    },
    // Admin is global (mine = null). Supervisor / User belong to one mine.
    mine: { type: mongoose.Schema.Types.ObjectId, ref: 'Mine', default: null },
    dept: {
      type: String,
      enum: [
        'Safety',
        'Explosive',
        'Environment & Forest',
        'Labour / HR',
        'Electrical',
        'Mining',
        '',
      ],
      default: '',
    },
    designation: { type: String, default: '' },
    // Escalation chain: user -> supervisor -> admin
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
