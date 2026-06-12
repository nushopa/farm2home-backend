const { Schema, model } = require("mongoose");

const CustomerSchema = new Schema(
  {
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      default: null,
    },
    phone_number: {
      type: String,
      default: "",
    },
    role: {
      type: Number,
      default: 2001,
    },

    city: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    proof_Of_Identity: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected", null],
      default: null,
    },
    review: {
      type: Boolean,
      default: null,
    },
    auth_provider: {
      type: String,
      enum: ["email", "google", "facebook", "apple"],
      default: "email",
    },
    provider_id: {
      type: String,
      default: null,
    },
    profile_picture: {
      type: String,
      default: null,
    },
    date_of_birth: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = model("Customer", CustomerSchema);
