const { Router } = require("express");
const {
  addCategorie,
  removeCategorie,
  getCategories,
} = require("../controllers/categorie.controller");

const CategorieRouter = Router();

/**
 * @swagger
 * tags:
 *   - name: Categories
 *     description: Product category tree
 */

/**
 * @swagger
 * /category/add:
 *   post:
 *     summary: Add a category
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cat]
 *             properties:
 *               cat: { type: string }
 *     responses:
 *       201: { description: Category created }
 */
CategorieRouter.post("/add", addCategorie);

/**
 * @swagger
 * /category/get:
 *   get:
 *     summary: Get the full category/subcategory tree
 *     tags: [Categories]
 *     responses:
 *       200: { description: Category tree }
 */
CategorieRouter.get("/get", getCategories);

/**
 * @swagger
 * /category/delete:
 *   delete:
 *     summary: Delete a category by ID
 *     tags: [Categories]
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
 *       200: { description: Category deleted }
 */
CategorieRouter.delete("/delete", removeCategorie);

module.exports = CategorieRouter;
