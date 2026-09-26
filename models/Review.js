const { Schema, model } = require("mongoose");

const ReviewSchema = new Schema(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null, 
    },
    rate: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

module.exports = model("Review", ReviewSchema);