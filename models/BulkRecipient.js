const mongoose = require('mongoose');

const BulkRecipientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  firm_name: { type: String },
  phone: { type: String },
  city: { type: String },
  address: { type: String },
  firm_logo: { type: String }, // Optional Base64
  status: { type: String, default: 'Pending' }, // Pending, Sending, Sent, Failed
  sentAt: { type: Date },
  error: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('BulkRecipient', BulkRecipientSchema);
