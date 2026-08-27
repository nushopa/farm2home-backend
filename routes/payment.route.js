const { Router } = require("express");
const {
  initializeTransaction,
  getOrderStatus,
} = require("../controllers/payment.controller");

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Paystack transaction initialization and order status polling
 */

const PaymentRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /payment/initialize:
   *   post:
   *     summary: Initialize a Paystack transaction for the customer's current cart
   *     description: >
   *       Computes the order total server-side from the customer's cart (subtotal + delivery fee + service
   *       charge), creates a PendingOrder record, and starts a Paystack transaction. The returned `reference`
   *       should be passed to the Paystack widget/button on the frontend. The actual order is only created
   *       once the `/webhook/paystack` endpoint confirms payment — this route never creates an Order itself.
   *     tags: [Payments]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [customer_id, address, email]
   *             properties:
   *               customer_id: { type: string }
   *               email: { type: string }
   *               address:
   *                 type: object
   *                 description: Selected delivery address for this order
   *     responses:
   *       200:
   *         description: Transaction initialized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reference: { type: string, description: PendingOrder ID, used as the Paystack reference }
   *                 amount: { type: number, description: Server-computed total in naira }
   *                 authorization_url: { type: string, description: Paystack-hosted checkout URL }
   *       400: { description: Missing fields or empty cart }
   *       422: { description: Missing required fields }
   *       500: { description: Could not start payment }
   */
  router.post("/initialize", initializeTransaction);

  /**
   * @swagger
   * /payment/status/{reference}:
   *   get:
   *     summary: Poll the status of a payment/order by reference
   *     description: >
   *       Used by the frontend after the Paystack popup closes, since a closed popup does not necessarily mean
   *       the payment failed (bank transfer and USSD confirm asynchronously via the Paystack webhook). Returns
   *       `fulfilled` once the webhook has created the Order, `pending` while awaiting confirmation, or
   *       `failed`/`not_found` otherwise.
   *     tags: [Payments]
   *     parameters:
   *       - in: path
   *         name: reference
   *         required: true
   *         schema: { type: string }
   *         description: The PendingOrder ID returned from /payment/initialize
   *     responses:
   *       200:
   *         description: Current status of the payment/order
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [pending, fulfilled, failed]
   *                 order:
   *                   type: object
   *                   description: Present only when status is "fulfilled"
   *       404: { description: No pending order or order found for this reference }
   *       500: { description: Could not retrieve order status }
   */
  router.get("/status/:reference", getOrderStatus);

  return router;
};

module.exports = PaymentRouter;