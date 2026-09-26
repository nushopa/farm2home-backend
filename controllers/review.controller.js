const Review = require("../models/Review");

module.exports.reviewRate = async (req, res, next) => {
  try {
    const { rate, comment, customer_id } = req.body;

    if (rate === undefined || rate === null || !comment) {
      return res.status(422).send({ message: "All fields are required!" });
    }

    const numericRate = Number(rate);
    if (Number.isNaN(numericRate) || numericRate < 1 || numericRate > 5) {
      return res.status(422).send({ message: "rate must be a number between 1 and 5." });
    }

    const review = await Review.create({
      rate: numericRate,
      comment,
      customer_id: customer_id || null,
    });

    return res.status(200).send({ message: "Review sent!", data: review });
  } catch (e) {
    next(e);
  }
};

module.exports.getAllReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find()
      .populate("customer_id", "first_name last_name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalItems = await Review.countDocuments();

    return res.status(200).send({
      reviews,
      totalItems,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (e) {
    next(e);
  }
};