const { Router } = require("express");
const {
  sendMessage,
  getAllContacts,
} = require("../controllers/contact.controller");

const contactRouter = (io) => {
  const router = Router();

  router.post("/contact", (req, res, next) => sendMessage(io, req, res, next));
  router.get("/", getAllContacts);

  return router;
};

module.exports = contactRouter;
