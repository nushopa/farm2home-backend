const { Router } = require("express");

const {
  addressBook,
  addAdress,
  deleteAddress,
} = require("../controllers/checkout.controller");
const {
  getDeliveryOptions,
  getFastDeliveryConfig,
  updateFastDeliveryConfig,
} = require("../controllers/delivery.controller");
const { authMiddleware } = require("../middleware/authMiddleware");

const checkOutRouter = Router();
const requireAdmin = (req, res, next) => {
  if (req.role !== 5000) {
    return res.status(403).send({ message: "Admin access required." });
  }
  return next();
};

/**
 * @swagger
 * tags:
 *   - name: Checkout
 *     description: Saved delivery addresses
 *   - name: Delivery
 *     description: Customer delivery options and admin provider settings
 */

/**
 * @swagger
 * /checkout/delivery-options:
 *   post:
 *     summary: Get standard and fast delivery quotes for an address
 *     tags: [Delivery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, address]
 *             properties:
 *               customer_id: { type: string }
 *               address: { type: object }
 *     responses:
 *       200: { description: Delivery options, prices and temporary quote IDs }
 *       422: { description: Delivery is unavailable for the selected city }
 */
checkOutRouter.post(
  "/delivery-options",
  authMiddleware,
  getDeliveryOptions,
);

/**
 * @swagger
 * /checkout/delivery-provider:
 *   get:
 *     summary: Get fast-delivery provider settings (admin only, secret omitted)
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     responses:
 *       200: { description: Provider endpoint and configuration status }
 *   put:
 *     summary: Update fast-delivery provider settings (admin only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Delivery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, feePath, enabled]
 *             properties:
 *               endpoint: { type: string }
 *               apiKey: { type: string }
 *               feePath: { type: string, example: data.amount }
 *               enabled: { type: boolean }
 *     responses:
 *       200: { description: Provider settings saved }
 *       403: { description: Admin access required }
 *       422: { description: Invalid provider settings }
 */
checkOutRouter
  .route("/delivery-provider")
  .all(authMiddleware, requireAdmin)
  .get(getFastDeliveryConfig)
  .put(updateFastDeliveryConfig);

/**
 * @swagger
 * /checkout/price:
 *   post:
 *     summary: Save a delivery address and get the estimated delivery price for its city
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, address, last_name, customer_id, email, phone_number, state, city]
 *             properties:
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               address: { type: string }
 *               email: { type: string }
 *               customer_id: { type: string }
 *               phone_number: { type: string }
 *               state: { type: string }
 *               city: { type: string }
 *               additional_phone_number: { type: string }
 *               directions: { type: string }
 *     responses:
 *       200:
 *         description: Address saved, estimated price returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 estimatePrice: { type: number }
 *       400: { description: Unknown error saving address }
 *       422: { description: Missing fields }
 */
checkOutRouter.post("/price", addAdress);

/**
 * @swagger
 * /checkout/address/{id}:
 *   get:
 *     summary: Get all saved addresses for a customer
 *     tags: [Checkout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: customer_id
 *     responses:
 *       200: { description: Saved addresses }
 *   delete:
 *     summary: Delete a saved address
 *     tags: [Checkout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: address document ID
 *     responses:
 *       200: { description: Address deleted successfully }
 *       404: { description: Address not found }
 */
checkOutRouter.get("/address/:id", addressBook);
checkOutRouter.delete("/address/:id", deleteAddress);

module.exports = checkOutRouter;
