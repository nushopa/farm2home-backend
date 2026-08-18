const { Router } = require("express");

const {
  getTotalAssignedOrders,
  getConfirmedOrders,
  getPendingOrders,
  getTotalCommission,
  getAssignedOrders,
} = require("../controllers/marketRepDashboard.controller");

const { authMiddleware } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: MarketRep Dashboard
 *     description: Distributor-facing dashboard stats
 */

const RepDashboardRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /marketrep/distributor-assigned/{distributorId}:
   *   get:
   *     summary: Get all orders assigned to a market rep
   *     tags: [MarketRep Dashboard]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Assigned orders }
   *       403: { description: User is not a market representative }
   */
  router.get("/distributor-assigned/:distributorId", authMiddleware, getAssignedOrders);

  /**
   * @swagger
   * /marketrep/assigned-orders/{distributorId}:
   *   get:
   *     summary: Total count of orders assigned to a market rep
   *     tags: [MarketRep Dashboard]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Total assigned orders
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { type: object, properties: { totalAssignedOrders: { type: integer } } }
   *       403: { description: User is not a market representative }
   */
  router.get("/assigned-orders/:distributorId", authMiddleware, getTotalAssignedOrders);

  /**
   * @swagger
   * /marketrep/confirmed-orders/{distributorId}:
   *   get:
   *     summary: Total count of confirmed orders for a market rep
   *     tags: [MarketRep Dashboard]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Total confirmed orders }
   *       403: { description: User is not a market representative }
   */
  router.get("/confirmed-orders/:distributorId", authMiddleware, getConfirmedOrders);

  /**
   * @swagger
   * /marketrep/pending-orders/{distributorId}:
   *   get:
   *     summary: Total count of pending (processing) orders for a market rep
   *     tags: [MarketRep Dashboard]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Total pending orders }
   *       403: { description: User is not a market representative }
   */
  router.get("/pending-orders/:distributorId", authMiddleware, getPendingOrders);

  /**
   * @swagger
   * /marketrep/total-commission/{distributorId}:
   *   get:
   *     summary: Total commission earned by a market rep (10% of completed order value)
   *     tags: [MarketRep Dashboard]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: distributorId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Total commission
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { type: object, properties: { totalCommission: { type: number } } }
   *       403: { description: User is not a market representative }
   */
  router.get("/total-commission/:distributorId", authMiddleware, getTotalCommission);

  return router;
};

module.exports = RepDashboardRouter;
