const mongoose = require("mongoose");

const DeliveryQuoteSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    address: { type: Object, required: true },
    delivery_mode: {
      type: String,
      enum: ["standard", "fast"],
      required: true,
    },
    delivery_fee: { type: Number, min: 0, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeliveryQuote", DeliveryQuoteSchema);
