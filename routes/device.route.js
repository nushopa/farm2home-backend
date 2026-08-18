const { Router } = require("express");
const { registerDevice, setDevicePreference } = require("../controllers/device.controller");
const { sendMarketingPush } = require("../controllers/marketing.controller");

/**
 * @swagger
 * tags:
 *   - name: Devices
 *     description: Push-notification device registration and preferences
 */

const DeviceRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /device/devices/register:
   *   post:
   *     summary: Register (or update) a device for push notifications. Works for logged-out devices too.
   *     tags: [Devices]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [deviceId, expoPushToken]
   *             properties:
   *               deviceId: { type: string }
   *               expoPushToken: { type: string }
   *               platform: { type: string, enum: [ios, android] }
   *     responses:
   *       200: { description: Device registered }
   *       400: { description: deviceId and expoPushToken are required }
   */
  router.post("/devices/register", registerDevice);

  /**
   * @swagger
   * /device/devices/preferences:
   *   patch:
   *     summary: Set push-notification preferences for a device
   *     tags: [Devices]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [deviceId]
   *             properties:
   *               deviceId: { type: string }
   *               pushEnabled: { type: boolean }
   *               marketingPushEnabled: { type: boolean }
   *     responses:
   *       200: { description: Preferences updated }
   *       400: { description: deviceId required, or at least one preference required }
   */
  router.patch("/devices/preferences", setDevicePreference);

  /**
   * @swagger
   * /device/marketing/push:
   *   post:
   *     summary: Send a marketing push notification to all opted-in devices (admin only)
   *     tags: [Devices]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, body]
   *             properties:
   *               title: { type: string }
   *               body: { type: string }
   *               data: { type: object }
   *     responses:
   *       200:
   *         description: Push sent
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 sent: { type: integer }
   *       400: { description: title and body are required }
   *       401: { description: Not authorized }
   */
  router.post("/marketing/push", sendMarketingPush);

  return router;
};

module.exports = DeviceRouter;
