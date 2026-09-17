const { Router } = require("express");
const {
  initializeTransaction,
  getOrderStatus,
} = require("../controllers/payment.controller");

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Squad transaction initialization and order status polling
 */

const PaymentRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /payment/initialize:
   *   post:
   *     summary: Initialize a Squad hosted-checkout transaction for the customer's current cart
   *     description: >
   *       Computes the order total server-side from the customer's cart (subtotal + delivery fee + service
   *       charge), creates a PendingOrder record, and starts a Squad transaction. The returned `reference`
   *       and `checkout_url` should be used to redirect the customer (web) or open a WebView pointed at
   *       `checkout_url` (mobile). The actual order is only created once the `/webhook/squad` endpoint
   *       confirms payment, or once `/payment/status/:reference` re-verifies it — this route never creates
   *       an Order itself.
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
   *               platform:
   *                 type: string
   *                 description: >
   *                   Optional. Pass "mobile" to have the server build a deep-link callback URL using
   *                   MOBILE_APP_SCHEME instead of the default web FRONTEND_URL callback.
   *               callback_url:
   *                 type: string
   *                 description: >
   *                   Optional explicit callback URL, used only as a fallback if neither MOBILE_APP_SCHEME
   *                   (for platform "mobile") nor FRONTEND_URL is configured.
   *     responses:
   *       200:
   *         description: Transaction initialized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reference: { type: string, description: PendingOrder ID, used as the Squad transaction_ref }
   *                 amount: { type: number, description: Server-computed total in naira }
   *                 checkout_url: { type: string, description: Squad-hosted checkout URL }
   *       400: { description: Empty cart }
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
   *       Used by the frontend after the checkout UI closes, since closing does not necessarily mean the
   *       payment failed — transfer and USSD channels confirm asynchronously via the Squad webhook. Returns
   *       `fulfilled` once an Order exists for this reference, `pending` while still awaiting confirmation
   *       (this call also actively re-verifies with Squad as a fallback in case the webhook was missed),
   *       `failed` if the payment did not succeed, `processing` if fulfillment is being claimed by a
   *       concurrent request, `flagged_for_review` if Squad's verified amount didn't match the expected
   *       total, or `not_found` if the reference doesn't exist.
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
   *                   enum: [pending, processing, fulfilled, failed, flagged_for_review, not_found]
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