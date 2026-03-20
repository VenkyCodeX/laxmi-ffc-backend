const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone:     { type: String, required: true, index: true },
  otp:       { type: String, required: true },
  expiresAt: { type: Date,   required: true, index: { expires: 0 } } // auto-delete when expired
});

module.exports = mongoose.model('Otp', otpSchema);
