const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    orderId: {
      type: String,
      ref: "Order",
    },
    full_name: {
      type: String,
      ref: "Order",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
