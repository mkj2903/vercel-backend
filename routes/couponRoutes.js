const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { adminAuth } = require('../middleware/adminAuth'); // ✅ FIXED

// ✅ GET all coupons (Admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ GET single coupon by ID
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      coupon
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ CREATE new coupon (Admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      totalQuantity,
      perUserLimit,
      applicableCategories
    } = req.body;

    const existingCoupon = await Coupon.findOne({ 
      code: code.toUpperCase() 
    });
    
    if (existingCoupon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coupon code already exists' 
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'End date must be after start date' 
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: discountType === 'percentage' ? maxDiscount : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalQuantity,
      perUserLimit: perUserLimit || 1,
      applicableCategories: applicableCategories || ['All'],
      isActive: true
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ UPDATE coupon (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      totalQuantity,
      perUserLimit,
      applicableCategories,
      isActive
    } = req.body;

    let coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    if (code && code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.toUpperCase() 
      });
      
      if (existingCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'Coupon code already exists' 
        });
      }
    }

    const updateFields = {};
    if (code) updateFields.code = code.toUpperCase();
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (discountType) updateFields.discountType = discountType;
    if (discountValue !== undefined) updateFields.discountValue = discountValue;
    if (minOrderAmount !== undefined) updateFields.minOrderAmount = minOrderAmount;
    if (maxDiscount !== undefined) updateFields.maxDiscount = maxDiscount;
    if (startDate) updateFields.startDate = new Date(startDate);
    if (endDate) updateFields.endDate = new Date(endDate);
    if (totalQuantity !== undefined) updateFields.totalQuantity = totalQuantity;
    if (perUserLimit !== undefined) updateFields.perUserLimit = perUserLimit;
    if (applicableCategories) updateFields.applicableCategories = applicableCategories;
    if (isActive !== undefined) updateFields.isActive = isActive;

    coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ DELETE coupon (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    if (coupon.usedCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete coupon that has been used' 
      });
    }

    await coupon.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ VALIDATE coupon (Public)
router.post('/validate', async (req, res) => {
  try {
    const { code, userId, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coupon code and order amount are required' 
      });
    }

    const couponValidation = await Coupon.validateCoupon(
      code, 
      userId, 
      orderAmount
    );

    res.status(200).json(couponValidation);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ✅ GET coupon usage statistics (Admin only)
router.get('/stats/usage', adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find({}, 'code name usedCount totalQuantity')
      .sort({ usedCount: -1 });

    const stats = coupons.map(coupon => ({
      code: coupon.code,
      name: coupon.name,
      used: coupon.usedCount,
      total: coupon.totalQuantity,
      usagePercentage: ((coupon.usedCount / coupon.totalQuantity) * 100).toFixed(1)
    }));

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;