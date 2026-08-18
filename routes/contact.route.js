const { Router } = require("express");
const {
  sendMessage,
  getAllContacts,
} = require("../controllers/contact.controller");

/**
 * @swagger
 * tags:
 *   - name: Contact
 *     description: "Contact-us / support messages"
 */

const contactRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /contact/contact:
   *   post:
   *     summary: Submit a contact-us message
   *     tags: [Contact]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fullname, email, message]
   *             properties:
   *               fullname: { type: string }
   *               email: { type: string }
   *               message: { type: string }
   *     responses:
   *       200: { description: Message sent }
   *       400: { description: Unable to send message }
   *       422: { description: Missing fields }
   */
  router.post("/contact", (req, res, next) => sendMessage(io, req, res, next));

  /**
   * @swagger
   * /contact/:
   *   get:
   *     summary: List all contact-us messages (paginated)
   *     tags: [Contact]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated contact list }
   */
  router.get("/", getAllContacts);

  return router;
};

module.exports = contactRouter;
