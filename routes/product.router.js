const { Router } = require("express");
const {
  getAllProduct,
  addProduct,
  getSingleProduct,
  removeProduct,
  updateProduct,
  getProductCount,
  toggleStock,
} = require("../controllers/product.controller");
const { getByQuery } = require("../controllers/categorie.controller");

const productRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Product catalog management
 */

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
 *       200:
 *         description: Paginated product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 totalItems: { type: integer }
 *                 currentPage: { type: integer }
 *                 totalPages: { type: integer }
 */
productRouter.get("/", getAllProduct);

/**
 * @swagger
 * /product/get/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product: { $ref: '#/components/schemas/Product' }
 */
productRouter.get("/get/:id", getSingleProduct);

/**
 * @swagger
 * /product/add:
 *   post:
 *     summary: Add a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_name
 *               - product_des
 *               - product_price
 *               - product_cat
 *               - product_rate
 *               - product_total
 *               - product_cost_price
 *             properties:
 *               product_name: { type: string }
 *               product_brand_name: { type: string }
 *               product_des: { type: string }
 *               product_price: { type: number }
 *               product_cost_price: { type: number }
 *               product_cat: { type: string }
 *               product_sub_cat: { type: string }
 *               product_sub_sub_cat: { type: string }
 *               product_rate: { type: number }
 *               product_total: { type: number }
 *               product_image: { type: string }
 *               alt_image: { type: string }
 *               out_of_stock: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 *       400: { description: Missing required fields }
 */
productRouter.post("/add", addProduct);

/**
 * @swagger
 * /product/remove/{id}:
 *   delete:
 *     summary: Delete a product (and remove it from any carts)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product deleted }
 *       400: { description: Error occurred }
 */
productRouter.delete("/remove/:id", removeProduct);

/**
 * @swagger
 * /product/update:
 *   put:
 *     summary: Update a product
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
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 */
productRouter.put("/update", updateProduct);

/**
 * @swagger
 * /product/toggle-stock:
 *   patch:
 *     summary: Toggle a product's out-of-stock flag (admin)
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
 *       200:
 *         description: Stock status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 *       400: { description: id and boolean out_of_stock required }
 *       404: { description: Product not found }
 */
productRouter.patch("/toggle-stock", toggleStock);

/**
 * @swagger
 * /product/categories:
 *   get:
 *     summary: Get products by category / subcategory / sub-subcategory
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: cat
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: subcat
 *         schema: { type: string }
 *       - in: query
 *         name: subsubcat
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 *       404: { description: Category/subcategory/sub-subcategory not found }
 */
productRouter.get("/categories", getByQuery);

/**
 * @swagger
 * /product/total:
 *   get:
 *     summary: Total product count
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Total product count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProducts: { type: integer }
 */
productRouter.get("/total", getProductCount);

module.exports = productRouter;
