const mongoose = require("mongoose");

const AdvertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Advert", AdvertSchema);