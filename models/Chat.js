const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  type: { type: String, default: "text" },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  orderID: { type: String, required: true }, // Change orderID to String
  messages: [messageSchema],
});

module.exports = mongoose.model("Chat", chatSchema);
