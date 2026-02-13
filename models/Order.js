const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  userName: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    unique: true,
    index: true,
  },
  
  // Order Items
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    size: {
      type: String,
      default: 'One Size'
    },
    price: {
      type: Number,
      required: true
    },
    image: String
  }],
  
  // Shipping Information
  shippingAddress: {
    fullName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  
  // Order Details
  totalAmount: {
    type: Number,
    required: true
  },
  subtotalAmount: {
    type: Number,
    default: 0
  },
  handlingCharge: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  
  // ✅ ADDED: Coupon Information
  couponCode: {
    type: String,
    default: ''
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  couponDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['UPI', 'COD'],
    default: 'UPI'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'to_collect', 'collected'],
    default: 'pending'
  },
  utrNumber: {
    type: String,
    default: ''
  },
  
  // Order Status
  status: {
    type: String,
    enum: ['payment_pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'payment_pending'
  },
  
  // Tracking Information
  trackingNumber: {
    type: String,
    default: ''
  },
  trackingUrl: String,
  carrier: String,
  
  // Admin Information
  adminNotes: {
    type: String,
    default: ''
  },
  
  // Timestamps
  expectedDelivery: Date,
  paymentVerifiedAt: Date,
  shippedAt: Date,
  deliveredAt: Date
}, {
  timestamps: true
});

// ✅ FIXED: COMPLETELY NEW SIMPLE PRE-SAVE HOOK
orderSchema.pre('save', function(next) {
  console.log('🔧 Pre-save hook called for order');
  
  // Only generate orderId if it doesn't exist
  if (!this.orderId || this.orderId.trim() === '') {
    console.log('🔧 Generating new orderId');
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderId = `ORD${year}${month}${day}${random}`;
    console.log(`🔧 Generated orderId: ${this.orderId}`);
  } else {
    console.log(`🔧 Using existing orderId: ${this.orderId}`);
  }
  
  // Ensure email is lowercase
  if (this.userEmail) {
    this.userEmail = this.userEmail.toLowerCase().trim();
  }
  
  // ✅ FIXED: Ensure next is called properly
  if (next && typeof next === 'function') {
    next();
  }
});

// ✅ FIXED: Static method to find by orderId
orderSchema.statics.findByOrderId = function(orderId) {
  return this.findOne({ 
    $or: [
      { orderId: orderId.trim() },
      { _id: orderId.trim() }
    ]
  });
};

module.exports = mongoose.model('Order', orderSchema);