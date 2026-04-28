const mongoose = require("mongoose");

const NewsLetterSchema = new mongoose.Schema({
  email: { type: String, trim: true, unique: true },
});

const News = mongoose.model("NewsLetter", NewsLetterSchema);

module.exports = News;
