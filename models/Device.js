const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    // Expo-managed iOS/Android clients (existing behavior, unchanged).
    expoPushToken: { type: String, default: null },
    // Firebase Web Push (FCM) token — browser clients only.
    webPushToken: { type: String, default: null },
    platform: { type: String, enum: ["ios", "android", "web"], default: null },
    // Which collection userId points into — customers, market reps, or riders.
    userModel: {
      type: String,
      enum: ["Customer", "Distributor", "Drivers"],
      default: "Customer",
    },
    userId: { type: mongoose.Schema.Types.ObjectId, refPath: "userModel", default: null },
    pushEnabled: { type: Boolean, default: true },
    marketingPushEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);