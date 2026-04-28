const { Schema, model } = require("mongoose");

const Reviewchema = new Schema(
  {
    rate: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = model("Review", Reviewchema);
