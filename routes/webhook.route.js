const { Router } = require("express");
const { paystackWebhook } = require("../controllers/payment.controller");

/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: Inbound server-to-server callbacks from third parties
 */

const WebhookRouter = () => {
  const router = Router();

  /**
   * @swagger
   * /webhook/paystack:
   *   post:
   *     summary: Paystack webhook — confirms payment and fulfills the order
   *     description: >
   *       Called server-to-server by Paystack for transaction events, for every payment channel including
   *       hosted checkout, bank transfer, and USSD. Verifies the `x-paystack-signature` header against the
   *       raw request body (captured globally in server.js as `req.rawBody`).
   *
   *       Handles two events: `charge.success` creates the Order and clears the cart. `bank.transfer.rejected`
   *       (Pay with Transfer only — sent when the customer transfers the wrong amount or is flagged by
   *       Paystack's fraud system, which triggers an automatic refund on Paystack's end) marks the
   *       PendingOrder as failed.
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Raw Paystack event payload
   *     responses:
   *       200: { description: Event acknowledged }
   *       401: { description: Invalid or missing Paystack signature }
   */
  router.post("/paystack", paystackWebhook);

  return router;
};

module.exports = WebhookRouter;