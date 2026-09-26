const { Router } = require("express");
const {
  getAllNotifications,
  getCustomerNotifications,
  getMarketRepNotifications,
  markNotificationRead,
  deleteNotification,
} = require("../controllers/notification.controller");

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: In-app notifications (general, customer, and market-rep specific)
 */

// NOTE: no longer takes `io` — the GET handlers are pure reads now.
// Update your server wiring from NotificationRouter(io) to NotificationRouter().
const NotificationRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /notification/:
   *   get:
   *     summary: Get all notifications (admin/staff)
   *     tags: [Notifications]
   */
  router.get("/", getAllNotifications);

  /**
   * @swagger
   * /notification/customer/{customerId}:
   *   get:
   *     summary: Get a customer's notification history (orders, status, marketing, new products)
   *     tags: [Notifications]
   *     parameters:
   *       - in: path
   *         name: customerId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Notifications for this customer }
   *       400: { description: Customer ID is required }
   */
  router.get("/customer/:customerId", getCustomerNotifications);

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
   *       200: { description: Notifications for this market rep }
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