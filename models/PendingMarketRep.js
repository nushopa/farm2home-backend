const { Schema, model } = require("mongoose");

const PendingMarketRepSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    otp: { type: String, },
    otpExpiry: { type: Date,},
    verified: { type: Boolean, default: false },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    password: { type: String },
    phoneNumber: { type: String, trim: true },
    dateOfBirth: { type: String },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    proofOfIdentity: { type: String },
    profilePicture: { type: String },
  },
  { timestamps: true }
);

module.exports = model("PendingMarketRep", PendingMarketRepSchema);
