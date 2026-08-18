const { Router } = require("express");
const {
  addPriceList,
  getPriceList,
  deleteCity,
  editCity,
  getCityById,
} = require("../controllers/pricelist.controller");

const priceListRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: PriceList
 *     description: Per-city delivery-price estimates
 */

/**
 * @swagger
 * /pricelist/add:
 *   post:
 *     summary: Add a city price entry
 *     tags: [PriceList]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [city, estimatePrice]
 *             properties:
 *               city: { type: string }
 *               estimatePrice: { type: number }
 *     responses:
 *       201:
 *         description: Price entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/PriceListEntry' }
 *       422: { description: Missing fields }
 */
priceListRouter.post("/add", addPriceList);

/**
 * @swagger
 * /pricelist:
 *   get:
 *     summary: Get all city price entries
 *     tags: [PriceList]
 *     responses:
 *       200:
 *         description: All price entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prices:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PriceListEntry' }
 */
priceListRouter.get("/", getPriceList);

/**
 * @swagger
 * /pricelist/delete/{id}:
 *   delete:
 *     summary: Delete a city price entry
 *     tags: [PriceList]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
priceListRouter.delete("/delete/:id", deleteCity);

/**
 * @swagger
 * /pricelist/edit:
 *   put:
 *     summary: Edit a city price entry
 *     tags: [PriceList]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, city, estimatePrice]
 *             properties:
 *               id: { type: string }
 *               city: { type: string }
 *               estimatePrice: { type: number }
 *     responses:
 *       200: { description: Updated }
 *       422: { description: Missing fields }
 */
priceListRouter.put("/edit", editCity);

/**
 * @swagger
 * /pricelist/{id}:
 *   get:
 *     summary: Get a city price entry by ID
 *     tags: [PriceList]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Price entry found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 city: { $ref: '#/components/schemas/PriceListEntry' }
 *       404: { description: City not found }
 */
priceListRouter.get("/:id", getCityById);

module.exports = priceListRouter;