const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const openingHoursSchema = new Schema({
  day: {
    type: String,
    required: true,
  },
  open: {
    type: String,
    required: true,
  },
  close: {
    type: String,
    required: true,
  },
});

const marketSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  openingHours: [openingHoursSchema],
  distributors: [{ type: Schema.Types.ObjectId, ref: "Distributor" }],
});

const Market = mongoose.model("Market", marketSchema);

module.exports = Market;
