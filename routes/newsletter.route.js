const { Router } = require("express");
const {
  subcribeNews,
  getAllNewsLetterSub,
  deleteNewsletterUser,
} = require("../controllers/newsletter.controller");

/**
 * @swagger
 * tags:
 *   - name: Newsletter
 *     description: Email newsletter subscriptions
 */

const newsLetterRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /news/subscribe:
   *   post:
   *     summary: Subscribe an email to the newsletter
   *     tags: [Newsletter]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string, format: email }
   *     responses:
   *       201: { description: Subscribed successfully }
   *       400: { description: Already subscribed }
   *       500: { description: Error }
   */
  router.post("/subscribe", (req, res, next) =>
    subcribeNews(io, req, res, next)
  );

  /**
   * @swagger
   * /news/:
   *   get:
   *     summary: List newsletter subscribers (paginated, admin only)
   *     tags: [Newsletter]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated subscriber list }
   *       401: { description: Not authorized }
   */
  router.get("/", getAllNewsLetterSub);

  /**
   * @swagger
   * /news/{id}:
   *   delete:
   *     summary: Remove a newsletter subscriber
   *     tags: [Newsletter]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Subscriber deleted successfully }
   *       404: { description: Subscriber not found }
   */
  router.delete("/:id", deleteNewsletterUser);

  return router;
};

module.exports = newsLetterRouter;