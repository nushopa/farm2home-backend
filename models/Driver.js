const { Schema, model } = require("mongoose");

const DriverModel = new Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    dateOfBirth: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    workCity: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: true,
      trim: true,
    },
    proofOfIdentity: {
      type: String,
      required: true,
    },
    licenseFile: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);
module.exports = model("Drivers", DriverModel);
