// models/Device.js
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    expoPushToken: { type: String, required: true },
    platform: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    pushEnabled: { type: Boolean, default: true },      
    marketingPushEnabled: { type: Boolean, default: true }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);