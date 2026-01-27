const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');
const { adminAuth } = require('../middleware/adminAuth');
const { sendPaymentStatus, sendOrderStatusUpdate } = require('../utils/emailController');

// ✅ FIXED: Remove extra '/admin' prefix from all routes

// Admin Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Hardcoded admin credentials
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tvmerch.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      res.json({
        success: true,
        message: 'Admin login successful',
        token: "admin-token-" + Date.now(),
        user: { email, role: 'admin' }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Dashboard Stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'payment_pending' });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ quantity: { $lt: 10 } });
    
    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email');
    
    // Sales data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const salesData = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'delivered' } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$totalAmount" },
        ordersCount: { $sum: 1 }
      }},
      { $sort: { _id: 1 } },
      { $limit: 7 }
    ]);
    
    // Format sales data for chart
    const formattedSalesData = salesData.map(item => ({
      date: item._id,
      sales: item.totalSales || 0
    }));
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalUsers,
        totalProducts,
        lowStockProducts
      },
      recentOrders: recentOrders.map(order => ({
        id: order._id,
        orderId: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        customer: order.user?.name || 'Unknown',
        amount: order.totalAmount,
        status: order.status,
        date: order.createdAt
      })),
      salesData: formattedSalesData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get All Orders
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let filter = {};
    
    if (status && status !== 'all') {
      // ✅ FIXED: Map frontend status to backend status
      const statusMap = {
        'pending': 'payment_pending',
        'confirmed': 'confirmed',
        'processing': 'processing',
        'shipped': 'shipped',
        'delivered': 'delivered',
        'cancelled': 'cancelled'
      };
      filter.status = statusMap[status] || status;
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email');
    
    const totalOrders = await Order.countDocuments(filter);
    
    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
      user: {
        name: order.user?.name || 'Unknown',
        email: order.user?.email || 'No email'
      },
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      utrNumber: order.utrNumber
    }));
    
    res.json({
      success: true,
      orders: formattedOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Order Status - ✅ UPDATED with email notification
router.put('/orders/:orderId/status', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // ✅ UPDATED: Valid statuses
    const validStatuses = ['payment_pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const order = await Order.findById(orderId).populate('user', 'email name');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const oldStatus = order.status;
    order.status = status;
    
    // Update timestamps based on status
    if (status === 'shipped' && !order.shippedAt) {
      order.shippedAt = new Date();
    } else if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }
    
    await order.save();
    
    // ✅ ADDED: Send status update email for certain status changes
    const notifyStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (notifyStatuses.includes(status) && oldStatus !== status) {
      try {
        await sendOrderStatusUpdate(order, status);
        console.log(`📧 Status update email sent for order ${orderId}: ${oldStatus} → ${status}`);
      } catch (emailError) {
        console.log('⚠️ Failed to send status update email:', emailError.message);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify Payment - ✅ UPDATED with email notification
router.post('/orders/:orderId/verify-payment', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, utrNumber } = req.body;
    
    console.log(`Payment verification request: orderId=${orderId}, action=${action}, utrNumber=${utrNumber}`);
    
    const order = await Order.findById(orderId).populate('user', 'email name');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (action === 'approve') {
      order.paymentStatus = 'verified';
      order.utrNumber = utrNumber || order.utrNumber;
      order.status = 'confirmed';  // ✅ Now this status exists
      order.paymentVerifiedAt = new Date();
      
      console.log(`Payment approved: Setting status to 'confirmed' for order ${orderId}`);
      
      // ✅ ADDED: Send payment approved email
      try {
        await sendPaymentStatus(order, 'verified');
        console.log(`📧 Payment approved email sent for order ${orderId}`);
      } catch (emailError) {
        console.log('⚠️ Failed to send payment approved email:', emailError.message);
        // Don't fail the request if email fails
      }
      
    } else if (action === 'reject') {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      console.log(`Payment rejected: Setting status to 'cancelled' for order ${orderId}`);
      
      // ✅ ADDED: Send payment rejected email
      try {
        await sendPaymentStatus(order, 'failed');
        console.log(`📧 Payment rejected email sent for order ${orderId}`);
      } catch (emailError) {
        console.log('⚠️ Failed to send payment rejected email:', emailError.message);
        // Don't fail the request if email fails
      }
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: `Payment ${action}d successfully`,
      order: {
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        utrNumber: order.utrNumber
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      errorDetails: error.toString() 
    });
  }
});

// ✅ ADDED: Admin email test route
router.post('/email/test', adminAuth, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(400).json({
        success: false,
        message: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS in .env file'
      });
    }

    const { sendEmail } = require('../utils/emailController');
    
    const testData = {
      orderId: 'TEST-' + Date.now().toString().slice(-6),
      userName: 'Test User',
      userEmail: email,
      totalAmount: 1999,
      createdAt: new Date(),
      shippingAddress: {
        fullName: 'Test User',
        address: '123 Test Street, Test Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        email: email
      },
      items: [
        { name: 'Breaking Bad T-Shirt', size: 'L', quantity: 1, price: 899 },
        { name: 'Game of Thrones Mug', size: 'One Size', quantity: 2, price: 299 }
      ],
      utrNumber: 'TEST123456789'
    };

    // Send test email
    const result = await sendEmail(
      email,
      'orderConfirmation',
      testData
    );

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully',
        details: result 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending test email',
      error: error.message 
    });
  }
});

// ✅ ADDED: Get email configuration (admin only)
router.get('/email/config', adminAuth, (req, res) => {
  try {
    const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    
    res.json({
      success: true,
      configured: emailConfigured,
      config: {
        emailHost: process.env.EMAIL_HOST || 'Not configured',
        emailUser: process.env.EMAIL_USER ? 'Configured' : 'Not configured',
        emailFrom: process.env.EMAIL_FROM || 'Not configured',
        bccEmail: process.env.EMAIL_BCC || 'Not configured'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ UPDATED: Product Management with Advanced Filtering
router.get('/products', adminAuth, async (req, res) => {
  try {
    const { 
      category, 
      gender, 
      status, 
      search, 
      sort = 'newest',
      page = 1, 
      limit = 20 
    } = req.query;
    
    let filter = {};
    
    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    // Gender filter (mainly for t-shirts)
    if (gender && gender !== 'all' && gender !== '') {
      filter.gender = gender;
    }
    
    // Status filter (isActive)
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      } else if (status === 'featured') {
        filter.featured = true;
      } else if (status === 'low-stock') {
        filter.quantity = { $lt: 10 };
      } else if (status === 'out-of-stock') {
        filter.quantity = 0;
      }
    }
    
    // Search filter
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { 'specifications.brand': searchRegex },
        { tags: searchRegex },
        { sku: searchRegex }
      ];
    }
    
    // Build sort options
    let sortOption = {};
    switch(sort) {
      case 'newest':
        sortOption.createdAt = -1;
        break;
      case 'oldest':
        sortOption.createdAt = 1;
        break;
      case 'price-high':
        sortOption.price = -1;
        break;
      case 'price-low':
        sortOption.price = 1;
        break;
      case 'name':
        sortOption.name = 1;
        break;
      case 'stock-high':
        sortOption.quantity = -1;
        break;
      case 'stock-low':
        sortOption.quantity = 1;
        break;
      case 'sales-high':
        sortOption.salesCount = -1;
        break;
      case 'featured':
        sortOption.featured = -1;
        break;
      default:
        sortOption.createdAt = -1;
    }
    
    const skip = (page - 1) * limit;
    
    // Execute query
    const products = await Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalProducts = await Product.countDocuments(filter);
    
    // Get statistics for dashboard
    const stats = {
      total: await Product.countDocuments(),
      active: await Product.countDocuments({ isActive: true }),
      inactive: await Product.countDocuments({ isActive: false }),
      featured: await Product.countDocuments({ featured: true }),
      lowStock: await Product.countDocuments({ quantity: { $lt: 10, $gt: 0 } }),
      outOfStock: await Product.countDocuments({ quantity: 0 }),
      tShirts: await Product.countDocuments({ category: 't-shirts' }),
      mugs: await Product.countDocuments({ category: 'mugs' }),
      accessories: await Product.countDocuments({ category: 'accessories' }),
      combos: await Product.countDocuments({ category: 'combos' })
    };
    
    res.json({
      success: true,
      products,
      stats,
      pagination: {
        total: totalProducts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalProducts / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching products',
      error: error.message 
    });
  }
});

router.post('/products', adminAuth, async (req, res) => {
  try {
    const productData = req.body;
    
    // Auto-calculate MRP if not provided
    if (!productData.mrp && productData.price && productData.discount) {
      productData.mrp = Math.round(productData.price / (1 - productData.discount / 100));
    } else if (!productData.mrp) {
      productData.mrp = productData.price;
    }
    
    // Set default values for optional fields
    if (!productData.sizes || productData.sizes.length === 0) {
      productData.sizes = ['One Size'];
    }
    
    if (!productData.colors || productData.colors.length === 0) {
      productData.colors = ['Black'];
    }
    
    // Set gender for t-shirts if not provided
    if (productData.category === 't-shirts' && !productData.gender) {
      productData.gender = 'unisex';
    }
    
    const product = new Product(productData);
    await product.save();
    
    res.json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle duplicate SKU error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists. Please try again or leave SKU blank for auto-generation.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating product',
      error: error.message 
    });
  }
});

router.get('/products/:productId', adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching product',
      error: error.message 
    });
  }
});

router.put('/products/:productId', adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const productData = req.body;
    
    // Auto-calculate MRP if price or discount changed
    if ((productData.price || productData.discount !== undefined) && !productData.mrp) {
      const currentProduct = await Product.findById(productId);
      const price = productData.price !== undefined ? productData.price : currentProduct.price;
      const discount = productData.discount !== undefined ? productData.discount : currentProduct.discount;
      
      if (price && discount !== undefined) {
        productData.mrp = Math.round(price / (1 - discount / 100));
      }
    }
    
    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: productData },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle duplicate SKU error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists. Please use a different SKU.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating product',
      error: error.message 
    });
  }
});

router.delete('/products/:productId', adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findByIdAndDelete(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting product',
      error: error.message 
    });
  }
});

// ✅ ADDED: Bulk update products (featured, active status, etc.)
router.post('/products/bulk-update', adminAuth, async (req, res) => {
  try {
    const { productIds, updates } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products selected for update'
      });
    }
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }
    
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: updates }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during bulk update',
      error: error.message 
    });
  }
});

// ✅ ADDED: Get product categories and counts for admin panel
router.get('/products/categories/stats', adminAuth, async (req, res) => {
  try {
    const categories = [
      't-shirts', 'mugs', 'accessories', 'combos', 'hoodies', 'caps', 'posters'
    ];
    
    const categoryStats = {};
    
    for (const category of categories) {
      const count = await Product.countDocuments({ category });
      const activeCount = await Product.countDocuments({ 
        category, 
        isActive: true 
      });
      const featuredCount = await Product.countDocuments({ 
        category, 
        featured: true 
      });
      
      categoryStats[category] = {
        total: count,
        active: activeCount,
        featured: featuredCount
      };
    }
    
    res.json({
      success: true,
      categoryStats
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching category statistics',
      error: error.message 
    });
  }
});

// User Management
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalUsers = await User.countDocuments();
    
    res.json({
      success: true,
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Review Management
router.get('/reviews', adminAuth, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    let filter = { status };
    
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name')
      .populate('product', 'name images');
    
    const totalReviews = await Review.countDocuments(filter);
    
    res.json({
      success: true,
      reviews,
      totalPages: Math.ceil(totalReviews / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/reviews/:reviewId/status', adminAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['approved', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    review.status = status;
    review.reviewedAt = new Date();
    await review.save();
    
    res.json({
      success: true,
      message: `Review ${status} successfully`,
      review
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;