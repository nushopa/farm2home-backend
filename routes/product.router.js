const { Router } = require("express");
const {
  getAllProduct,
  getSingleProduct,
  addProduct,
  removeProduct,
  updateProduct,
  toggleStock,
  getProductCount,
} = require("../controllers/product.controller");

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Product catalog management
 */

// I don't have your original product.router.js, so this is reconstructed
// from product.controller.js's actual exports. It now needs to be a
// factory that takes `io` (same pattern as OrderRouter/DriverRouter),
// because addProduct persists + broadcasts a "new product" notification.
// Please diff this against your real file for anything it had that isn't
// reflected here — e.g. auth/admin middleware on write routes, multer or
// other upload handling for product_image, rate limiting, etc.
const ProductRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /product:
   *   get:
   *     summary: List products (paginated, optionally filtered by category)
   *     tags: [Products]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema: { type: string }
   *         description: Filter by product_cat
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 50 }
   *     responses:
   *       200: { description: Paginated product list }
   *   post:
   *     summary: Add a new product (admin)
   *     tags: [Products]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [product_name, product_des, product_price, product_cat, product_rate, product_total, product_cost_price]
   *             properties:
   *               product_name: { type: string }
   *               product_brand_name: { type: string }
   *               product_image: { type: string }
   *               alt_image: { type: string }
   *               product_des: { type: string }
   *               product_price: { type: number }
   *               product_cat: { type: string }
   *               product_sub_cat: { type: string }
   *               product_sub_sub_cat: { type: string }
   *               product_rate: { type: number }
   *               product_total: { type: number }
   *               product_cost_price: { type: number }
   *               out_of_stock: { type: boolean }
   *     responses:
   *       201: { description: Product created, marketing push + new_product notification sent }
   *       400: { description: Missing required fields }
   */
  router.get("/", getAllProduct);
  router.post("/", (req, res, next) => addProduct(io, req, res, next));

  /**
   * @swagger
   * /product/count:
   *   get:
   *     summary: Total number of products
   *     tags: [Products]
   *     responses:
   *       200: { description: Total product count }
   */
  router.get("/count", getProductCount);

  /**
   * @swagger
   * /product/stock:
   *   patch:
   *     summary: Toggle a product's out_of_stock flag (admin)
   *     tags: [Products]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id, out_of_stock]
   *             properties:
   *               id: { type: string }
   *               out_of_stock: { type: boolean }
   *     responses:
   *       200: { description: Stock flag updated }
   *       400: { description: id and a boolean out_of_stock are required }
   *       404: { description: Product not found }
   */
  router.patch("/stock", toggleStock);

  /**
   * @swagger
   * /product:
   *   put:
   *     summary: Update a product (admin)
   *     tags: [Products]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id]
   *             properties:
   *               id: { type: string }
   *     responses:
   *       200: { description: Product updated }
   */
  router.put("/", updateProduct);

  /**
   * @swagger
   * /product/{id}:
   *   get:
   *     summary: Get a single product by ID
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Product found }
   *   delete:
   *     summary: Delete a product (admin) — also purges it from any carts
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Product deleted }
   *       400: { description: An error occurred }
   */
  router.get("/:id", getSingleProduct);
  router.delete("/:id", removeProduct);

  return router;
};

module.exports = ProductRouter;