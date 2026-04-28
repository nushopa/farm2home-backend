const mongoose = require("mongoose");

const PriceListSchema = new mongoose.Schema({
  city: { type: String, trim: true },
  estimatePrice: { type: Number },
});

const PriceList = mongoose.model("PriceList", PriceListSchema);

module.exports = PriceList;
