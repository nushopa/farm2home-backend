const mongoose = require("mongoose");

const PriceListSchema = new mongoose.Schema({
  city: { type: String, trim: true, required: true },
  estimatePrice: { type: Number, min: 0, required: true },
});

const PriceList = mongoose.model("PriceList", PriceListSchema);

module.exports = PriceList;
