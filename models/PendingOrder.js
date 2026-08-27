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
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "fulfilled", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingOrder", pendingOrderSchema);