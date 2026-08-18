const { Router } = require("express");
const {
  addToCart,
  getSingleCart,
  deleteFromCart,
  addToQuatity,
  minusToQuatity,
} = require("../controllers/cart.controller");

const CartRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: Shopping cart operations
 */

/**
 * @swagger
 * /cart/add:
 *   post:
 *     summary: Add a product to a customer's cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, customer_id]
 *             properties:
 *               product_id: { type: string }
 *               customer_id: { type: string }
 *     responses:
 *       200:
 *         description: Product added to cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product: { $ref: '#/components/schemas/CartItem' }
 *       400: { description: Missing IDs, product out of stock, or already in cart }
 *       404: { description: Product not found }
 */
CartRouter.post("/add", addToCart);

/**
 * @swagger
 * /cart/get/{id}:
 *   get:
 *     summary: Get a customer's cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: customer_id
 *     responses:
 *       200:
 *         description: Cart contents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cart:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CartItem' }
 */
CartRouter.get("/get/:id", getSingleCart);

/**
 * @swagger
 * /cart/inc:
 *   put:
 *     summary: Increment a cart item's quantity
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, description: Cart item ID }
 *     responses:
 *       200: { description: Quantity incremented }
 *       400: { description: Product currently out of stock }
 *       404: { description: Cart not found }
 * /cart/dec:
 *   put:
 *     summary: Decrement a cart item's quantity (removes item at 1)
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, description: Cart item ID }
 *     responses:
 *       200: { description: Quantity decremented or item removed }
 *       404: { description: Cart not found }
 */
CartRouter.put("/inc", addToQuatity);
CartRouter.put("/dec", minusToQuatity);

/**
 * @swagger
 * /cart/delete:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, description: Cart item ID }
 *     responses:
 *       200: { description: Item removed }
 *       404: { description: Cart not found }
 */
CartRouter.delete("/delete", deleteFromCart);

module.exports = CartRouter;
