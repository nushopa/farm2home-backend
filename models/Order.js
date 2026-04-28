const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    customer_id: {
       type: mongoose.Schema.Types.ObjectId, 
       ref: "Customer" 
      },
    amount_paid: {
       type: Number 
      },
    products: {
       type: Array, 
       required: true 
      },
    markets: {
       type: Array, 
       required: true 
      },
    address: { type: Object },
    status: { type: String, default: "Processing" },
    orderID: { type: String, trim: true, unique: true },
    distributor_assigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    driver_assigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drivers",
      default: null,
    },
    pickup_location: { type: String, default: null },
    pickup_duration: { type: String, default: "0min" },
    pickup_distance: { type: String, default: "0km" },
    delivery_duration: { type: String, default: "0min" },
    delivery_distance: { type: String, default: "0km" },
    delivery_code: { type: String },
    product_image: { type: String, default: null },
  },
  { timestamps: true }
);

const order = mongoose.model("Order", OrderSchema);
module.exports = order;