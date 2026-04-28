const mongoose = require('mongoose');

const tempUserSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true,
  },
  last_name: {
    type: String,
    required: true,
  },
  phone_number: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
  },
  otp: {
    type: String,
    required: true,
  },
  otpExpires: {
    type: Date,
    required: true,
  }
}, {
  timestamps: true
});

// Auto-delete documents after they expire
tempUserSchema.index({ "otpExpires": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TempUser', tempUserSchema);