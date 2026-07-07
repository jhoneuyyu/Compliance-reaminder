const mongoose = require('mongoose');

const CreditTransactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  credit_change: { type: Number, required: true },
  transaction_type: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema);
