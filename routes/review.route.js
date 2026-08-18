const { Router } = require("express");
const { reviewRate } = require("../controllers/review.controller");

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
 *               rate: { type: number }
 *               comment: { type: string }
 *     responses:
 *       200: { description: Review sent }
 *       400: { description: An error occurred }
 *       422: { description: Missing fields }
 */
reviewRouter.post("/review", reviewRate);

module.exports = reviewRouter;
