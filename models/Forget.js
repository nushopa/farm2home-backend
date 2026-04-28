const mongoose = require("mongoose");

const ForgetSchema = new mongoose.Schema({
  user_id: {
    type: String,
  },
  otp: {
    type: String,
    required: true,
  },
});

const Forget = mongoose.model("Forget", ForgetSchema);

module.exports = Forget;
