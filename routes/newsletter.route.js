const { Router } = require("express");
const {
  subcribeNews,
  getAllNewsLetterSub,
  deleteNewsletterUser,
} = require("../controllers/newsletter.controller");

const newsLetterRouter = (io) => {
  const router = Router();

  // post
  router.post("/subscribe", (req, res, next) =>
    subcribeNews(io, req, res, next)
  );
  router.get("/", getAllNewsLetterSub);
  router.delete("/:id", deleteNewsletterUser);
  return router;
};

module.exports = newsLetterRouter;
