const mongoose = require("mongoose");
const { ACCESS_TOKEN_TTL_MS } = require("../constant/authConstants");

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: ACCESS_TOKEN_TTL_MS / 1000  }, 
});

module.exports = mongoose.model("BlacklistedToken", blacklistedTokenSchema);