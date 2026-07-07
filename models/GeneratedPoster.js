const mongoose = require('mongoose');

const GeneratedPosterSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  poster_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Poster', required: true },
  generated_date: { type: Date, default: Date.now },
  credits_used: { type: Number, default: 1 },
  download_url: { type: String }
});

module.exports = mongoose.model('GeneratedPoster', GeneratedPosterSchema);
