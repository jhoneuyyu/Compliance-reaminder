const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  credits: { type: Number, default: 20 },
  profile_completion: { type: Number, default: 0.0 },
  expiry_date: { type: String },
  role: { type: String, default: 'user' },
  is_active: { type: Number, default: 1 },
  firm_logo: { type: String },
  address: { type: String },
  city: { type: String },
  resetToken: { type: String }
});

module.exports = mongoose.model('User', UserSchema);
