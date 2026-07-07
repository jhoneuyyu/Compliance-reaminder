const mongoose = require('mongoose');

const PosterSchema = new mongoose.Schema({
  month: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  image_url: { type: String, required: true },
  custom_image_base64: { type: String },
  description: { type: String },
  footer: {
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number }
  }
});

module.exports = mongoose.model('Poster', PosterSchema);
