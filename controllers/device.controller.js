const Device = require("../models/Device");
const { getOptionalUserId } = require("../lib/util/optionalAuth");


module.exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, expoPushToken, webPushToken, platform } = req.body;

    if (!deviceId) {
      return res.status(400).send({ message: "deviceId is required" });
    }
    if (!expoPushToken && !webPushToken) {
      return res
        .status(400)
        .send({ message: "expoPushToken or webPushToken is required" });
    }
    if (webPushToken && platform !== "web") {
      return res
        .status(400)
        .send({ message: "platform must be 'web' when registering a webPushToken" });
    }

    const userId = getOptionalUserId(req); // null if logged out — that's fine

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        deviceId,
        platform,
        ...(expoPushToken ? { expoPushToken } : {}),
        ...(webPushToken ? { webPushToken } : {}),
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