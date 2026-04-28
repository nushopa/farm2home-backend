const { authMiddleware } = require("../middleware/authMiddleware");
const News = require("../models/NewsLetter");
const Notification = require("../models/Notification");

// subscribe
module.exports.subcribeNews = async (io, req, res, next) => {
  const { email } = req.body;

  // check if subscribed
  if (!email) return res.status(500).send({ message: "error" });

  const exits = await News.findOne({ email });

  if (exits) return res.status(400).send({ message: "Already subscribed!" });

  const saved = await News.create({ email });

  if (saved)
    await Notification.create({
      category: "newsletter",
      title: "newsletter signup",
      message: `${email} signed up for newsletter`,
    });

  // Emit notifications to all connected clients
  const notifications = await Notification.find();
  io.emit("notification", notifications);
  return res.status(201).send({ message: "You have subscribed successfully" });
};
module.exports.getAllNewsLetterSub = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
      if (role === 2001)
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      const { page = 1, limit = 20 } = req.query; // Default to page 1 and limit of 20
      const skip = (page - 1) * limit;

      const newsletter = await News.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await News.countDocuments();

      return res.status(200).send({
        newsletter,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving all orders." });
  }
};
module.exports.deleteNewsletterUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if the user exists
    const newsletter = await News.findById(id);
    if (!newsletter) {
      return res.status(404).send({ message: "User not found!" });
    }

    // Delete the customer
    await News.findByIdAndDelete(id);

    return res.status(200).send({ message: "Newsletter deleted successfully" });
  } catch (error) {
    next(error);
  }
};
