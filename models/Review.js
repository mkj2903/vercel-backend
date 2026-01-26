const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminMessage: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: Date
  },
  helpful: {
    type: Number,
    default: 0
  },
  notHelpful: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Update product rating when a review is approved
reviewSchema.post('save', async function(doc) {
  if (doc.status === 'approved') {
    const Review = mongoose.model('Review');
    const Product = mongoose.model('Product');
    
    const reviews = await Review.find({
      product: doc.product,
      status: 'approved'
    });
    
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      await Product.findByIdAndUpdate(doc.product, {
        avgRating: parseFloat(avgRating.toFixed(1)),
        reviewCount: reviews.length
      });
    }
  }
});

module.exports = mongoose.model('Review', reviewSchema);