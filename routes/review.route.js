const { Router } = require("express");
const { reviewRate, getAllReviews } = require("../controllers/review.controller");

const reviewRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Reviews
 *     description: General app/service reviews
 */

/**
 * @swagger
 * /review/review:
 *   post:
 *     summary: Submit a rating and comment
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rate, comment]
 *             properties:
 *               rate: { type: number, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *               customer_id: { type: string }
 *     responses:
 *       200: { description: Review sent }
 *       422: { description: Missing fields or rate out of range }
 *   get:
 *     summary: Get all reviews (paginated)
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated review list }
 */
reviewRouter.post("/review", reviewRate);
reviewRouter.get("/review", getAllReviews);

module.exports = reviewRouter;