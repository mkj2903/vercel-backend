const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon'); // ✅ ADDED: Import Coupon model
const { sendOrderConfirmation } = require('../utils/emailController');

// ✅ HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Order routes are working',
    timestamp: new Date().toISOString()
  });
});

// ✅ CREATE ORDER (Public endpoint) - UPDATED WITH PER-USER COUPON TRACKING
router.post('/', async (req, res) => {
  try {
    console.log('📦 Creating order with data:', JSON.stringify(req.body, null, 2));
    
    const { 
      userEmail, 
      userName, 
      items, 
      shippingAddress, 
      totalAmount, 
      subtotalAmount,
      deliveryCharge,
      handlingCharge,
      discount,
      couponCode,           // ✅ ADDED: Coupon code
      couponDiscount,       // ✅ ADDED: Coupon discount amount
      couponDetails,        // ✅ ADDED: Full coupon details
      paymentMethod = 'UPI', 
      utrNumber = '',
      status = 'payment_pending',
      paymentStatus = 'pending'
    } = req.body;

    // ✅ SIMPLIFIED VALIDATION
    if (!userEmail || userEmail.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'userEmail is required'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    // Clean email
    const cleanEmail = userEmail.toLowerCase().trim();

    // Validate payment method
    const validPaymentMethods = ['UPI', 'COD'];
    const finalPaymentMethod = paymentMethod.toUpperCase();
    
    if (!validPaymentMethods.includes(finalPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Use "UPI" or "COD"'
      });
    }

    // UTR validation for UPI
    let finalUtrNumber = '';
    if (finalPaymentMethod === 'UPI') {
      if (!utrNumber || utrNumber.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'UTR number is required for UPI payments'
        });
      }
      
      // Clean UTR (remove spaces)
      finalUtrNumber = utrNumber.toString().replace(/\D/g, '').slice(0, 12);
      
      if (finalUtrNumber.length !== 12) {
        return res.status(400).json({
          success: false,
          message: 'UTR must be 12 digits for UPI payments'
        });
      }
    }

    // ✅ FIND OR CREATE USER – moved BEFORE coupon validation to get userId
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = new User({
        email: cleanEmail,
        name: userName || cleanEmail.split('@')[0],
        role: 'customer'
      });
      await user.save();
    }
    const userId = user._id;

    // ✅ COUPON VALIDATION AND INCREMENT USAGE – PER-USER TRACKING
    let finalCouponCode = '';
    let finalCouponDiscount = 0;
    let finalCouponDetails = null;
    
    if (couponCode && couponCode.trim() !== '') {
      try {
        const coupon = await Coupon.findOne({ 
          code: couponCode.toUpperCase(),
          isActive: true 
        });

        if (coupon) {
          // Calculate order amount for min-order validation
          const orderAmount = subtotalAmount || items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
          
          // ✅ Use the model's validateCoupon method (checks dates, quantity, per-user limit, min order)
          const validation = await Coupon.validateCoupon(couponCode, userId, orderAmount);

          if (validation.valid) {
            finalCouponCode = coupon.code;
            finalCouponDiscount = couponDiscount || validation.coupon.discount; // fallback if frontend didn't send
            finalCouponDetails = couponDetails || {
              code: coupon.code,
              name: coupon.name,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue
            };
            
            // ✅ Increment both global usedCount and per-user usage
            await coupon.incrementUsage(userId);
            console.log(`🎫 Coupon ${coupon.code} applied – global count +1, user ${userId} count +1`);
          } else {
            console.log(`⚠️ Coupon validation failed for ${couponCode}: ${validation.message}`);
          }
        } else {
          console.log(`⚠️ Coupon ${couponCode} not found or inactive`);
        }
      } catch (couponError) {
        console.error('Coupon processing error:', couponError);
        // Continue without coupon if validation fails
      }
    }

    // ✅ SIMPLIFIED: Prepare order items
    const orderItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const itemData = {
        name: item.name || 'Product',
        quantity: item.quantity || 1,
        size: item.size || 'One Size',
        price: item.price || 0,
        image: item.image || ''
      };
      
      // Add product reference if available
      if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        itemData.product = item.product;
      }
      
      orderItems.push(itemData);
      calculatedTotal += (item.price || 0) * (item.quantity || 1);
    }

    // ✅ SIMPLIFIED: Prepare shipping address
    const formattedShippingAddress = {
      fullName: shippingAddress?.fullName || userName || 'Customer',
      email: shippingAddress?.email || cleanEmail,
      phone: shippingAddress?.phone || '',
      address: shippingAddress?.address || `${shippingAddress?.houseFlat || ''} ${shippingAddress?.street || ''}`.trim() || 'Not provided',
      city: shippingAddress?.city || '',
      state: shippingAddress?.state || '',
      pincode: shippingAddress?.pincode || '',
      country: shippingAddress?.country || 'India'
    };

    // ✅ FIXED: Use frontend values or calculate if not provided
    const subtotal = subtotalAmount || calculatedTotal;
    const finalDeliveryCharge = deliveryCharge !== undefined ? deliveryCharge : (subtotal >= 199 ? 0 : 9);
    
    let finalHandlingCharge = handlingCharge;
    let finalDiscount = discount;
    let finalPaymentStatus = paymentStatus;
    
    // If frontend didn't send charges, calculate based on payment method
    if (handlingCharge === undefined || discount === undefined) {
      if (finalPaymentMethod === 'COD') {
        finalHandlingCharge = 9;
        finalDiscount = 0;
        finalPaymentStatus = 'to_collect';
      } else if (finalPaymentMethod === 'UPI') {
        finalHandlingCharge = 0;
        finalDiscount = 10;
      }
    }
    
    // Calculate final total - Use frontend total or calculate from breakdown
    const finalTotalAmount = totalAmount || (subtotal + finalDeliveryCharge + finalHandlingCharge - finalDiscount - finalCouponDiscount);
    
    console.log('💰 Payment calculation:');
    console.log(`   Subtotal: ₹${subtotal}`);
    console.log(`   Delivery: ₹${finalDeliveryCharge} ${finalDeliveryCharge === 0 ? '(FREE)' : ''}`);
    console.log(`   Handling: ₹${finalHandlingCharge}`);
    console.log(`   UPI Discount: ₹${finalDiscount}`);
    console.log(`   Coupon Discount: ₹${finalCouponDiscount}`);
    console.log(`   Total: ₹${finalTotalAmount}`);
    console.log(`   Payment Method: ${finalPaymentMethod}`);
    if (finalCouponCode) {
      console.log(`   Coupon Applied: ${finalCouponCode} (-₹${finalCouponDiscount})`);
    }

    // ✅ CREATE ORDER WITH CORRECT DATA (INCLUDING COUPON)
    const orderData = {
      user: userId,                           // ✅ Use the found/created user _id
      userEmail: cleanEmail,
      userName: userName || user.name || cleanEmail.split('@')[0],
      items: orderItems,
      shippingAddress: formattedShippingAddress,
      totalAmount: finalTotalAmount,
      subtotalAmount: subtotal,
      handlingCharge: finalHandlingCharge,
      discount: finalDiscount,
      deliveryCharge: finalDeliveryCharge,
      couponCode: finalCouponCode,           // ✅ ADDED
      couponDiscount: finalCouponDiscount,   // ✅ ADDED
      couponDetails: finalCouponDetails,     // ✅ ADDED
      paymentMethod: finalPaymentMethod,
      paymentStatus: finalPaymentStatus,
      utrNumber: finalUtrNumber,
      status: status
    };

    console.log('📊 Creating order with data:', orderData);

    const order = new Order(orderData);
    await order.save();

    console.log('✅ Order created successfully:', order.orderId);
    console.log(`💰 Payment: ${order.paymentMethod}, Total: ₹${order.totalAmount}`);
    if (order.couponCode) {
      console.log(`🎫 Coupon: ${order.couponCode} saved ₹${order.couponDiscount}`);
    }
    
    // ✅ Send email (don't block order creation if email fails)
    try {
      const emailResult = await sendOrderConfirmation(order.toObject());
      if (emailResult.success) {
        console.log(`📧 Order confirmation email sent to ${cleanEmail}`);
      } else {
        console.log(`⚠️ Email failed but order created:`, emailResult.error);
      }
    } catch (emailError) {
      console.log('⚠️ Email error (order still created):', emailError.message);
    }

    // ✅ SUCCESS RESPONSE
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        userEmail: order.userEmail,
        userName: order.userName,
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount,
        handlingCharge: order.handlingCharge,
        discount: order.discount,
        couponCode: order.couponCode,         // ✅ ADDED
        couponDiscount: order.couponDiscount, // ✅ ADDED
        deliveryCharge: order.deliveryCharge,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        utrNumber: order.utrNumber,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle duplicate orderId
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order ID already exists. Please try again.'
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ TRACK ORDER (Public) - FIXED (NO MORE ObjectId ERROR)
router.get('/track/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    let { email } = req.query;

    console.log(`🔍 Tracking order: ${orderId}, email: ${email}`);

    if (!orderId || orderId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Email is required for tracking'
      });
    }

    // Clean email
    email = email.toLowerCase().trim();

    // ✅ FIXED: Use custom orderId field for search, NOT _id
    const order = await Order.findOne({
      orderId: orderId.trim(),
      userEmail: email
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found. Please check your Order ID and Email.'
      });
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        orderId: order.orderId,
        userEmail: order.userEmail,
        userName: order.userName,
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount,
        handlingCharge: order.handlingCharge,
        discount: order.discount,
        couponCode: order.couponCode,         // ✅ ADDED
        couponDiscount: order.couponDiscount, // ✅ ADDED
        deliveryCharge: order.deliveryCharge,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        utrNumber: order.utrNumber,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error tracking order:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking order'
    });
  }
});

// ✅ GET ORDERS BY USER EMAIL (For My Orders page) - UPDATED WITH COUPON
router.get('/user/:email', async (req, res) => {
  try {
    let { email } = req.params;
    
    if (!email || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Clean email
    email = email.toLowerCase().trim();

    const orders = await Order.find({ userEmail: email })
      .sort({ createdAt: -1 })
      .select('-__v');

    // Ensure all orders have orderId
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.orderId,
      userEmail: order.userEmail,
      userName: order.userName,
      items: order.items,
      totalAmount: order.totalAmount,
      subtotalAmount: order.subtotalAmount || 0,
      handlingCharge: order.handlingCharge || 0,
      discount: order.discount || 0,
      couponCode: order.couponCode || '',         // ✅ ADDED
      couponDiscount: order.couponDiscount || 0, // ✅ ADDED
      deliveryCharge: order.deliveryCharge || 0,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders'
    });
  }
});

// ✅ GET ORDER BY ID (Support both orderId and _id) - UPDATED WITH COUPON
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || orderId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Try to find by custom orderId first
    let order = await Order.findOne({ orderId: orderId.trim() });
    
    // If not found by orderId, try by _id (only if it's a valid ObjectId)
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId.trim());
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        orderId: order.orderId,
        userEmail: order.userEmail,
        userName: order.userName,
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount || 0,
        handlingCharge: order.handlingCharge || 0,
        discount: order.discount || 0,
        couponCode: order.couponCode || '',         // ✅ ADDED
        couponDiscount: order.couponDiscount || 0, // ✅ ADDED
        deliveryCharge: order.deliveryCharge || 0,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        utrNumber: order.utrNumber,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order'
    });
  }
});

module.exports = router;