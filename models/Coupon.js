const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    required: true,
    default: 0
  },
  maxDiscount: {
    type: Number,
    default: null
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: 1
  },
  userUsage: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [{
    type: String,
    enum: ['T-Shirts', 'Mugs', 'Accessories', 'All']
  }]
}, {
  timestamps: true
});

// ✅ Static method to validate coupon (with per-user limit check)
couponSchema.statics.validateCoupon = async function(code, userId, orderAmount) {
  const coupon = await this.findOne({ 
    code: code.toUpperCase(),
    isActive: true 
  });

  if (!coupon) {
    return { 
      valid: false, 
      message: 'Invalid coupon code' 
    };
  }

  const now = new Date();
  if (now < coupon.startDate) {
    return { 
      valid: false, 
      message: 'Coupon is not yet active' 
    };
  }

  if (now > coupon.endDate) {
    return { 
      valid: false, 
      message: 'Coupon has expired' 
    };
  }

  // ✅ Check total usage limit
  if (coupon.usedCount >= coupon.totalQuantity) {
    return { 
      valid: false, 
      message: 'Coupon usage limit reached' 
    };
  }

  // ✅ Check per-user usage limit
  if (userId) {
    const userUsageEntry = coupon.userUsage.find(
      entry => entry.userId && entry.userId.toString() === userId.toString()
    );
    const userUsedCount = userUsageEntry ? userUsageEntry.count : 0;
    
    if (userUsedCount >= coupon.perUserLimit) {
      return {
        valid: false,
        message: `You have already used this coupon ${userUsedCount} time(s). Maximum ${coupon.perUserLimit} per user.`
      };
    }
  }

  if (orderAmount < coupon.minOrderAmount) {
    return { 
      valid: false, 
      message: `Minimum order amount ₹${coupon.minOrderAmount} required` 
    };
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = coupon.discountValue;
  }

  if (discount > orderAmount) {
    discount = orderAmount;
  }

  return {
    valid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount: Math.round(discount),
      minOrderAmount: coupon.minOrderAmount,
      maxDiscount: coupon.maxDiscount,
      perUserLimit: coupon.perUserLimit,
      usedCount: coupon.usedCount,
      totalQuantity: coupon.totalQuantity
    }
  };
};

// ✅ Method to increment usage count (both global and per-user)
couponSchema.methods.incrementUsage = async function(userId) {
  // Increment global count
  this.usedCount += 1;
  
  // Increment per-user count
  if (userId) {
    const existingEntry = this.userUsage.find(
      entry => entry.userId && entry.userId.toString() === userId.toString()
    );
    
    if (existingEntry) {
      existingEntry.count += 1;
    } else {
      this.userUsage.push({ userId, count: 1 });
    }
  }
  
  await this.save();
};

module.exports = mongoose.model('Coupon', couponSchema);