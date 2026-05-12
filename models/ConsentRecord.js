const mongoose = require("mongoose");

const ConsentRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: String, 
      required: true,
      index: true,
    },
    preferences: {
      essential: { type: Boolean, default: true },
      analytics: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
    },
    timestamp: { type: Date, required: true },
    version: { type: String, required: true },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

const ConsentRecord = mongoose.model("ConsentRecord", ConsentRecordSchema);
module.exports = ConsentRecord;