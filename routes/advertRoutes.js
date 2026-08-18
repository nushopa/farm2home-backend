const { Router } = require("express");
const {
  uploadAdvert,
  getAdverts,
  editAdvert,
  deleteAdvert
} = require("../controllers/advert.controller");
const upload = require("../middleware/upload");

/**
 * @swagger
 * tags:
 *   - name: Adverts
 *     description: Homepage/banner advert management (images hosted on Cloudinary)
 */

const AdvertRoute = () => {
  const router = Router();

  /**
   * @swagger
   * /adverts/:
   *   post:
   *     summary: Upload a new advert image
   *     tags: [Adverts]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file, title]
   *             properties:
   *               file: { type: string, format: binary }
   *               title: { type: string }
   *     responses:
   *       200: { description: Advert uploaded successfully }
   *       400: { description: Image file or title is required }
   *       500: { description: Error uploading to Cloudinary }
   *   get:
   *     summary: List all adverts
   *     tags: [Adverts]
   *     responses:
   *       200: { description: All adverts, most recent first }
   */
  router.post("/", upload.single("file"), uploadAdvert);
  router.get("/", getAdverts);

  /**
   * @swagger
   * /adverts/{id}:
   *   put:
   *     summary: Edit an advert (title and/or replace image)
   *     tags: [Adverts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               title: { type: string }
   *               file: { type: string, format: binary }
   *     responses:
   *       200: { description: Advert updated successfully }
   *       404: { description: Advert not found }
   *       500: { description: Error uploading new image }
   *   delete:
   *     summary: Delete an advert
   *     tags: [Adverts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Advert deleted successfully }
   *       404: { description: Advert not found }
   */
  router.put("/:id", upload.single("file"), editAdvert);
  router.delete("/:id", deleteAdvert);

  return router;
};

module.exports = AdvertRoute;
