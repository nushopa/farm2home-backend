const { Router } = require("express");
const {
  getAllNotifications,
  getMarketRepNotifications,
  markNotificationRead,
  deleteNotification,
} = require("../controllers/notification.controller");

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: In-app notifications (general and market-rep specific)
 */

const NotificationRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /notification/:
   *   get:
   *     summary: Get all notifications
   *     tags: [Notifications]
   *     responses:
   *       200:
   *         description: All notifications
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Notification' }
   */
  router.get("/", (req, res) => getAllNotifications(io, res));

  /**
   * @swagger
   * /notification/marketrep/{distributorId}:
   *   get:
   *     summary: Get notifications for a specific market rep
   *     tags: [Notifications]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Notifications for this market rep
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Notification' }
   *       400: { description: Distributor ID is required }
   */
  router.get("/marketrep/:distributorId", getMarketRepNotifications);

  /**
   * @swagger
   * /notification/{id}/read:
   *   patch:
   *     summary: Mark a notification as read
   *     tags: [Notifications]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Notification marked as read }
   *       404: { description: Notification not found }
   */
  router.patch("/:id/read", markNotificationRead);

  /**
   * @swagger
   * /notification/{id}:
   *   delete:
   *     summary: Delete a notification
   *     tags: [Notifications]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Notification deleted successfully }
   *       404: { description: Notification not found }
   */
  router.delete("/:id", deleteNotification);

  return router;
};

module.exports = NotificationRouter;
