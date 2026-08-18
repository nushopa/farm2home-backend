const { Router } = require("express");
const { saveConsent } = require("../controllers/consentController");

/**
 * @swagger
 * tags:
 *   - name: Consent
 *     description: Cookie/privacy consent records
 */

const ConsentRoute = () => {
  const router = Router();

  /**
   * @swagger
   * /consent/:
   *   post:
   *     summary: Save (or update) a user's consent preferences
   *     tags: [Consent]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [preferences, timestamp, version]
   *             properties:
   *               preferences:
   *                 type: object
   *                 properties:
   *                   analytics: { type: boolean }
   *                   marketing: { type: boolean }
   *               timestamp: { type: string, format: date-time }
   *               version: { type: string }
   *     responses:
   *       200: { description: Consent saved successfully }
   *       400: { description: Missing required fields }
   */
  router.post("/", saveConsent);

  return router;
};

module.exports = ConsentRoute;
