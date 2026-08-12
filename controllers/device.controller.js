const Device = require("../models/Device");
const { getOptionalUserId } = require("../lib/util/optionalAuth");


module.exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, expoPushToken, platform } = req.body;

    if (!deviceId || !expoPushToken) {
      return res.status(400).send({ message: "deviceId and expoPushToken are required" });
    }

    const userId = getOptionalUserId(req); // null if logged out — that's fine

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        deviceId,
        expoPushToken,
        platform,
        ...(userId ? { userId } : {}), // only overwrite when we actually have one
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).send({ success: true, device });
  } catch (error) {
    next(error);
  }
};

module.exports.setDevicePreference = async (req, res, next) => {
  try {
    const { deviceId, pushEnabled, marketingPushEnabled } = req.body;

    if (!deviceId) {
      return res.status(400).send({ message: "deviceId is required" });
    }

    if (typeof pushEnabled !== "boolean" && typeof marketingPushEnabled !== "boolean") {
      return res
        .status(400)
        .send({ message: "At least one of pushEnabled or marketingPushEnabled (boolean) is required" });
    }

    const update = {};
    if (typeof pushEnabled === "boolean") update.pushEnabled = pushEnabled;
    if (typeof marketingPushEnabled === "boolean") update.marketingPushEnabled = marketingPushEnabled;

    const device = await Device.findOneAndUpdate(
      { deviceId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).send({ success: true, device });
  } catch (error) {
    next(error);
  }
};