const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  fullname: { type: String, trim: true },
  email: { type: String, trim: true },
  message: { type: String, trim: true },
});

const Contact = mongoose.model("Contact", ContactSchema);

module.exports = Contact;