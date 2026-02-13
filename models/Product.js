const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  subCategory: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 1
  },
  mrp: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // ✅ FIXED: SIMPLE IMAGES ARRAY
  images: {
    type: [String],
    default: []
  },
  colors: {
    type: [String],
    default: ['Black']
  },
  sizes: {
    type: [String],
    default: []
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  specifications: {
    material: { type: String, default: 'Cotton' },
    brand: { type: String, default: 'TV Merchandise' },
    weight: { type: String, default: '' },
    dimensions: { type: String, default: '' },
    washCare: { type: String, default: 'Machine wash cold' }
  },
  careInstructions: {
    type: [String],
    default: []
  },
  tags: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  dealOfDay: {
    type: Boolean,
    default: false
  },
  dealExpiry: {
    type: Date,
    default: null
  },
  salesCount: {
    type: Number,
    default: 0
  },
  avgRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  showName: {
    type: String,
    default: ''
  },
  season: {
    type: String,
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

// ✅ FIXED: SINGLE PRE-SAVE HOOK WITHOUT "next" ERROR
productSchema.pre('save', function(next) {
  try {
    // Generate SKU if not provided
    if (!this.sku) {
      const prefixMap = {
        't-shirts': 'TSH',
        'mugs': 'MUG',
        'accessories': 'ACC',
        'combos': 'COM',
        'hoodies': 'HOD',
        'caps': 'CAP',
        'posters': 'PST',
        'photo-frames': 'FRM',
        'others': 'OTH'
      };
      
      const prefix = prefixMap[this.category] || 'PRO';
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.sku = `${prefix}-${timestamp}-${random}`;
    }
    
    // Set MRP if not provided
    if (!this.mrp || this.mrp === 0) {
      this.mrp = this.price;
    }
    
    // ✅ FIXED: Ensure images array exists
    if (!this.images || !Array.isArray(this.images) || this.images.length === 0) {
      this.images = ['https://via.placeholder.com/500x500.png?text=TV+Merch+Product'];
    }
    
    // Call next only if it's a function
    if (typeof next === 'function') {
      next();
    }
  } catch (error) {
    console.error('Error in pre-save hook:', error);
    if (typeof next === 'function') {
      next(error);
    }
  }
});

// ✅ SIMPLIFIED INDEXES
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ featured: 1 });

// ✅ SIMPLE METHODS
productSchema.methods.isInStock = function() {
  return this.quantity > 0;
};

productSchema.methods.isLowStock = function() {
  return this.quantity > 0 && this.quantity < 10;
};

module.exports = mongoose.model('Product', productSchema);