const { Router } = require("express");
const { squadWebhook } = require("../controllers/payment.controller");

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
   * /webhook/squad:
   *   post:
   *     summary: Squad webhook — confirms payment and fulfills the order
   *     description: >
   *       Called server-to-server by Squad for transaction events, for every payment channel including card,
   *       bank transfer, and USSD. Verifies the `x-squad-signature` header (an HMAC SHA512 of the raw request
   *       body, signed with your secret key) against the raw request body (captured globally in server.js as
   *       `req.rawBody`).
   *
   *       Handles the `charge_successful` event: when its nested `Body.transaction_status` is `"Success"`,
   *       creates the Order and clears the cart. Also handles `charge_failed`, `transfer_failed`, and
   *       `transfer_reversed` by marking the PendingOrder as failed — note these three event names are not
   *       confirmed in Squad's official docs (sourced from a third-party SDK) and should be verified against
   *       real sandbox webhook payloads. Regardless of event-name accuracy, `/payment/status/:reference`
   *       actively re-verifies with Squad as a fallback so a missed or misnamed webhook doesn't strand the
   *       order.
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             description: Raw Squad event payload
   *     responses:
   *       200: { description: Event acknowledged }
   *       401: { description: Missing or invalid Squad signature }
   */
  router.post("/squad", squadWebhook);

  return router;
};

module.exports = WebhookRouter;