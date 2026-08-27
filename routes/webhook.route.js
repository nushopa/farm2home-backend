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
   *       Called server-to-server by Paystack for transaction events (e.g. `charge.success`), for every payment
   *       channel including bank transfer and USSD. Verifies the `x-paystack-signature` header against the raw
   *       request body (captured globally in server.js as `req.rawBody`), then creates the Order and clears the cart.
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