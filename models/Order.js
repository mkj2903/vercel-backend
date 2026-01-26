const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    unique: true,
    required: false
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
  
  // Payment Information
  paymentMethod: {
    type: String,
    default: 'UPI'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  utrNumber: {
    type: String,
    default: ''
  },
  
  // Order Status - ✅ UPDATED: Added 'confirmed' status
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

// ✅ REMOVED: Problematic pre-save hook completely

module.exports = mongoose.model('Order', orderSchema);