const Contact = require("../models/Contact");
const Notification = require("../models/Notification");

async function sendMessage(io, req, res, next) {
  try {
    const { fullname, email, message } = req.body;

    if (!fullname || !email || !message)
      return res.status(422).send({ message: "All fields are required!" });

    const saved = await Contact.create({
      fullname,
      email,
      message,
    });
    await Notification.create({
      title: "message from support portal",
      category: "support-portal",
      message: message,
    });
    // Emit notifications to all connected clients
    const notifications = await Notification.find();
    io.emit("notification", notifications);

    if (saved) return res.status(200).send({ message: "Message sent!" });
    else return res.status(400).send({ message: "Unable to send message!" });
  } catch (error) {
    next(error);
  }
}

// Controller to get all contacts
async function getAllContacts(req, res, next) {
  const { page = 1, limit = 20 } = req.query; // Default to page 1 and limit of 20
  const skip = (page - 1) * limit;

  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 }) // Sort by newest messages first
      .skip(skip)
      .limit(parseInt(limit));

    const totalItems = await Contact.countDocuments(); // Total number of contacts

    res.status(200).send({
      contacts,
      totalItems,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { sendMessage, getAllContacts };
