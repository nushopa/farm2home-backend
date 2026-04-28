const Review = require("../models/Review");

module.exports.reviewRate = async (req, res, next) => {
  try {
    const { rate, comment } = req.body;

    if (!rate || !comment)
      return res.status(422).send({ message: "All fields are required!" });

    const saved = await Review.create({ rate, comment });
    if (saved) return res.status(200).send({ message: "Review sent!" });
    else return res.status(400).send({ message: "An error occured!" });
  } catch (e) {
    next(e);
  }
};
