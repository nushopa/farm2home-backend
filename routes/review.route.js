const { Router } = require("express");
const { reviewRate } = require("../controllers/review.controller");

const reviewRouter = Router();

reviewRouter.post("/review", reviewRate);

module.exports = reviewRouter;
