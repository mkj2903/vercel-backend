const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const { sendOrderConfirmation } = require('../utils/emailController');

// ✅ HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Order routes are working',
    timestamp: new Date().toISOString()
  });
});

// ✅ CREATE ORDER (Public endpoint) - UPDATED with email notification
router.post('/', async (req, res) => {
  try {
    console.log('📦 Creating order with data:', req.body);
    
    const { 
      userEmail, 
      userName, 
      items, 
      shippingAddress, 
      totalAmount, 
      paymentMethod = 'UPI', 
      utrNumber = '',
      status = 'payment_pending',
      paymentStatus = 'pending'
    } = req.body;

    // Validate required fields
    if (!userEmail || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userEmail and items are required'
      });
    }

    // Validate UTR if provided
    if (utrNumber && !/^\d{12}$/.test(utrNumber)) {
      return res.status(400).json({
        success: false,
        message: 'UTR must be 12 digits'
      });
    }

    // Find or create user
    let user = await User.findOne({ email: userEmail });
    if (!user) {
      user = new User({
        email: userEmail,
        name: userName || userEmail.split('@')[0],
        role: 'customer'
      });
      await user.save();
    }

    // Prepare order items
    const orderItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      let product;
      
      if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        product = await Product.findById(item.product);
      }

      if (product) {
        orderItems.push({
          product: product._id,
          name: product.name || item.name || 'Product',
          quantity: item.quantity || 1,
          size: item.size || 'One Size',
          price: product.price || item.price || 0,
          image: product.images?.[0] || item.image || ''
        });
        
        calculatedTotal += (product.price || 0) * (item.quantity || 1);
      } else {
        // Use provided item data if product not found
        orderItems.push({
          name: item.name || 'Product',
          quantity: item.quantity || 1,
          size: item.size || 'One Size',
          price: item.price || 0,
          image: item.image || ''
        });
        
        calculatedTotal += (item.price || 0) * (item.quantity || 1);
      }
    }

    // Generate order ID
    const generateOrderId = () => {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `ORD${year}${month}${day}${random}`;
    };

    // Prepare shipping address
    const formattedShippingAddress = {
      fullName: shippingAddress?.fullName || userName || 'Customer',
      email: shippingAddress?.email || userEmail,
      phone: shippingAddress?.phone || '',
      address: `${shippingAddress?.houseFlat || ''} ${shippingAddress?.street || ''}`.trim(),
      city: shippingAddress?.city || '',
      state: shippingAddress?.state || '',
      pincode: shippingAddress?.pincode || '',
      country: shippingAddress?.country || 'India'
    };

    // Create order
    const order = new Order({
      user: user._id,
      userEmail: userEmail,
      userName: userName || user.name,
      orderId: generateOrderId(),
      items: orderItems,
      shippingAddress: formattedShippingAddress,
      totalAmount: totalAmount || calculatedTotal,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      utrNumber: utrNumber,
      status: status
    });

    await order.save();

    console.log('✅ Order created successfully:', order.orderId);
    
    // ✅ ADDED: Send order confirmation email
    try {
      const emailResult = await sendOrderConfirmation(order);
      if (emailResult.success) {
        console.log(`📧 Order confirmation email sent to ${userEmail}`);
      } else {
        console.log(`⚠️ Failed to send confirmation email: ${emailResult.error}`);
        // Don't fail the order if email fails
      }
    } catch (emailError) {
      console.log('⚠️ Email error (order still created):', emailError.message);
      // Don't fail the order if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        userEmail: order.userEmail,
        userName: order.userName,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    // Handle duplicate orderId
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate order ID. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ TRACK ORDER (Public)
router.get('/track/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find by orderId or _id
    const order = await Order.findOne({
      $or: [
        { orderId: orderId },
        { _id: orderId }
      ],
      userEmail: email
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error tracking order'
    });
  }
});

// ✅ GET ALL ORDERS (Admin - use adminRoutes instead)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      orders,
      count: orders.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders'
    });
  }
});

module.exports = router;