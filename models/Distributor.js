const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const distributorSchema = new Schema(
  {
    firstName: {
      type: String,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
      required: true,
    },
    proofOfIdentity: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    city: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: Boolean,
    },
    review: {
      type: Boolean,
    },
    profilePicture: {
      type: String,
    },
    dateOfBirth: {
      type: String,
      required: true,
    },
    authProvider: { type: String, 
      enum: [
        "email", 
        "google", 
        "facebook"
      ], 
      default: "email" 
    },
    providerId: { 
      type: String, 
      default: null 
    },     
    isProfileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Distributor = mongoose.model("Distributor", distributorSchema);

module.exports = Distributor;
