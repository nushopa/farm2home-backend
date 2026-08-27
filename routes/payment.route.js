const { Router } = require("express");
const {
  initializeTransaction,
  paystackWebhook,
  getOrderStatus,
} = require("../controllers/payment.controller");

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Paystack transaction initialization, webhook confirmation, and order status polling
 */

const PaymentRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /payment/initialize:
   *   post:
   *     summary: Initialize a Paystack transaction for the customer's current cart
   *     description: >
   *       Computes the order total server-side from the customer's cart (subtotal + delivery fee + service charge),
   *       creates a PendingOrder record, and starts a Paystack transaction. The returned `reference` should be
   *       passed to the Paystack widget/button on the frontend.
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
   *       500: { description: Could not start payment }
   */
  router.post("/initialize", initializeTransaction);

  /**
   * @swagger
   * /webhook/paystack:
   *   post:
   *     summary: Paystack webhook — confirms payment and fulfills the order
   *     description: >
   *       Called server-to-server by Paystack for transaction events (e.g. `charge.success`), for every payment
   *       channel including bank transfer and USSD. Verifies the `x-paystack-signature` header against the raw
   *       request body, then creates the Order, decrements stock, and clears the cart. This route requires the
   *       raw (unparsed) request body — it must be mounted before any global `express.json()` middleware, or
   *       mounted with `express.raw({ type: "application/json" })` applied specifically to this path.
   *     tags: [Payments]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Raw Paystack event payload (not parsed by Express JSON middleware)
   *     responses:
   *       200: { description: Event acknowledged }
   *       401: { description: Invalid or missing Paystack signature }
   */
  router.post("/paystack", paystackWebhook);

  /**
   * @swagger
   * /payment/status/{reference}:
   *   get:
   *     summary: Poll the status of a payment/order by reference
   *     description: >
   *       Used by the frontend after the Paystack popup closes, since a closed popup does not necessarily mean
   *       the payment failed (especially for bank transfer). Returns `fulfilled` once the webhook has created
   *       the Order, `pending` while awaiting confirmation, or `failed`/`not_found` otherwise.
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
   */
  router.get("/status/:reference", getOrderStatus);

  return router;
};

module.exports = PaymentRouter;