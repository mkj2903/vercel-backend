// backend/models/Product.js - COMPLETE UPDATED
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
    enum: ['t-shirts', 'mugs', 'accessories', 'combos', 'hoodies', 'caps', 'posters'],
    required: true
  },
  subCategory: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'unisex', ''],
    default: ''
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
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size'],
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
    XXL: { type: Number, default: 0 },
    '3XL': { type: Number, default: 0 },
    'One Size': { type: Number, default: 0 }
  },
  specifications: {
    fabric: String,
    fit: String,
    printType: String,
    sleeve: String,
    neck: String,
    capacity: String,
    material: String,
    dimensions: String,
    weight: String,
    brand: String
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
  },
  // Additional fields for better filtering
  showName: {
    type: String,
    default: ''
  },
  season: {
    type: String,
    enum: ['winter', 'summer', 'all-season', ''],
    default: ''
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate SKU before saving
productSchema.pre('save', function(next) {
  if (!this.sku) {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    this.sku = `${prefix}-${Date.now().toString().slice(-6)}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);