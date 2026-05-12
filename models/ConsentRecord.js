const mongoose = require('mongoose');

const ConsentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  preferences: {
    essential: { type: Boolean, required: true },
    analytics: { type: Boolean, required: true },
    marketing: { type: Boolean, required: true },
  },
  timestamp: { type: Date, required: true },
  version: { type: String, required: true },
  userAgent: { type: String },
});

// Optional: enforce unique userId if you only want one record per user
ConsentSchema.index({ userId: 1 }, { unique: true });

const ConsentRecord = mongoose.model('ConsentRecord', ConsentSchema);

module.exports = ConsentRecord;