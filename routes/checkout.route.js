const { Router } = require("express");

const {
  addressBook,
  addAdress,
  deleteAddress,
} = require("../controllers/checkout.controller");

const checkOutRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Checkout
 *     description: Saved delivery addresses
 */

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
