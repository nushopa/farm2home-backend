const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true }
);

// TTL cleanup — Mongo drops the doc once expiresAt passes, revoked or not.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);