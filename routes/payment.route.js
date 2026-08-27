const { Router } = require("express");
const {
  initializeTransaction,
  initializeBankTransferCharge,
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
   *     summary: Initialize a Paystack hosted-checkout transaction for the customer's current cart
   *     description: >
   *       Computes the order total server-side from the customer's cart (subtotal + delivery fee + service
   *       charge), creates a PendingOrder record, and starts a Paystack transaction. The returned `reference`
   *       and `authorization_url` should be used with the Paystack popup (web) or a WebView pointed at
   *       `authorization_url` (mobile). The actual order is only created once the `/webhook/paystack` endpoint
   *       confirms payment — this route never creates an Order itself.
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
   *               callback_url:
   *                 type: string
   *                 description: >
   *                   Optional deep link Paystack redirects to once the hosted checkout finishes. Used by
   *                   mobile clients rendering `authorization_url` in a WebView; omit for web.
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
   *       400: { description: Empty cart }
   *       422: { description: Missing required fields }
   *       500: { description: Could not start payment }
   */
  router.post("/initialize", initializeTransaction);

  /**
   * @swagger
   * /payment/initialize-transfer:
   *   post:
   *     summary: Initialize a Pay with Transfer (PwT) charge for the customer's current cart
   *     description: >
   *       Computes the order total server-side (same logic as `/payment/initialize`), creates a PendingOrder
   *       record, and calls Paystack's Charge API with a `bank_transfer` object to generate a temporary
   *       account number. Intended for a native "Deposit" style UI (e.g. mobile app) rather than a redirect —
   *       render the returned bank details directly instead of opening a WebView. The actual order is only
   *       created once the `/webhook/paystack` endpoint receives a `charge.success` event for this reference;
   *       a `bank.transfer.rejected` event (wrong amount, or fraud flag) marks the PendingOrder as failed
   *       instead. This route never creates an Order itself.
   *
   *       Requires Pay with Transfer to be enabled on the Paystack account. Available to Nigeria and Ghana
   *       businesses only.
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
   *         description: Transfer account generated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reference: { type: string, description: PendingOrder ID, used as the Paystack reference }
   *                 amount: { type: number, description: Server-computed total in naira }
   *                 account_name: { type: string }
   *                 account_number: { type: string }
   *                 bank_name: { type: string }
   *                 account_expires_at:
   *                   type: string
   *                   description: ISO 8601 timestamp — the account becomes invalid after this time
   *       400: { description: Empty cart }
   *       422: { description: Missing required fields }
   *       500: { description: Could not start payment }
   *       502: { description: Paystack returned an unexpected charge status }
   */
  router.post("/initialize-transfer", initializeBankTransferCharge);

  /**
   * @swagger
   * /payment/status/{reference}:
   *   get:
   *     summary: Poll the status of a payment/order by reference
   *     description: >
   *       Used by the frontend after the checkout UI closes (popup, WebView, or the native transfer sheet),
   *       since closing does not necessarily mean the payment failed — bank transfer and USSD confirm
   *       asynchronously via the Paystack webhook. Returns `fulfilled` once the webhook has created the
   *       Order, `pending` while awaiting confirmation, or `failed`/`not_found` otherwise.
   *     tags: [Payments]
   *     parameters:
   *       - in: path
   *         name: reference
   *         required: true
   *         schema: { type: string }
   *         description: The PendingOrder ID returned from /payment/initialize or /payment/initialize-transfer
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