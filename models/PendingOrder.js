const mongoose = require("mongoose");
const { Schema } = mongoose;

const pendingOrderSchema = new Schema(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    address: {
      type: Object,
      required: true,
    },
    products: [
      {
        product_id: { type: Schema.Types.ObjectId, ref: "Product" },
        product_quatity: Number,
        product_name: String,
        unit_price: { type: Number, min: 0 },
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    delivery_mode: {
      type: String,
      enum: ["standard", "fast"],
      default: "standard",
    },
    delivery_fee: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["pending", "fulfilled", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingOrder", pendingOrderSchema);