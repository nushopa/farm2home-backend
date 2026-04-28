const { Schema, model } = require("mongoose");

const PendingDriverSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    otp: { type: String, },
    otpExpiry: { type: Date, },
    verified: { type: Boolean, default: false },
    vehicleType: { type: String, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    password: { type: String },
    phoneNumber: { type: String, trim: true },
    dateOfBirth: { type: String },
    address: { type: String, trim: true },
    workCity: { type: String, trim: true },
    proofOfIdentity: { type: String },
    licenseFile: { type: String },
  },
  { timestamps: true }
);

module.exports = model("PendingDriver", PendingDriverSchema);
