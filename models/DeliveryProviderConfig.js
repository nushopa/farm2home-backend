const mongoose = require("mongoose");

const DeliveryProviderConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["fast-delivery"],
      default: "fast-delivery",
      unique: true,
    },
    endpoint: { type: String, default: "" },
    apiKey: { type: String, default: "" },
    feePath: { type: String, default: "amount" },
    enabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "DeliveryProviderConfig",
  DeliveryProviderConfigSchema,
);
