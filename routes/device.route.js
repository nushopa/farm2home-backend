const { Router } = require("express");
const { registerDevice, setDevicePreference } = require("../controllers/device.controller");
const { sendMarketingPush } = require("../controllers/marketing.controller");

const DeviceRouter = () => {
  const router = Router();

  // Public — must work for logged-out (anonymous) devices too.
  router.post("/devices/register", registerDevice);
  router.patch("/devices/preferences", setDevicePreference);

  // Admin-only — auth + role check happens inside the controller,
  // matching the pattern used by other admin routes in this codebase.
  router.post("/marketing/push", sendMarketingPush);

  return router;
};

module.exports = DeviceRouter;