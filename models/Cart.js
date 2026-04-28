const { Schema, model } = require("mongoose");

const CartSchema = new Schema(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    product_quatity: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

module.exports = model("Cart", CartSchema);
