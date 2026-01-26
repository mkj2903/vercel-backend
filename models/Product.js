const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['t-shirts', 'mugs', 'hoodies', 'accessories'],
    required: true
  },
  subCategory: {
    type: String,
    enum: ['men', 'women', 'unisex', 'coffee-mug', 'travel-mug'],
    default: 'unisex'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  mrp: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  images: [{
    type: String,
    required: true
  }],
  colors: [{
    type: String,
    default: ['Black', 'White', 'Red', 'Blue']
  }],
  sizes: [{
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    default: ['S', 'M', 'L', 'XL']
  }],
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  sizeWiseStock: {
    XS: { type: Number, default: 0 },
    S: { type: Number, default: 0 },
    M: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    XL: { type: Number, default: 0 },
    XXL: { type: Number, default: 0 }
  },
  specifications: {
    fabric: String,
    fit: String,
    printType: String,
    sleeve: String,
    neck: String,
    capacity: String,
    material: String
  },
  careInstructions: [String],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  salesCount: {
    type: Number,
    default: 0
  },
  avgRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);