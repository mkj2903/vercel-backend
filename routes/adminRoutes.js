const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon'); // ✅ ADDED: Import Coupon model
const { adminAuth } = require('../middleware/adminAuth');
const { sendPaymentStatus, sendOrderStatusUpdate } = require('../utils/emailController');

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ ADMIN LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tvmerch.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = "admin-token-" + Date.now();
      
      res.json({
        success: true,
        message: 'Admin login successful',
        token: token,
        user: { 
          email, 
          role: 'admin',
          name: 'Admin'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ GET DASHBOARD STATS
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'payment_pending' });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ quantity: { $lt: 10 } });
    
    // ✅ ADDED: Coupon stats
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({ 
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email');
    
    const formattedRecentOrders = recentOrders.map(order => ({
      id: order._id,
      orderId: order.orderId || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
      customer: order.userName || order.user?.name || 'Unknown',
      amount: order.totalAmount,
      status: order.status,
      date: order.createdAt
    }));
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalUsers,
        totalProducts,
        lowStockProducts,
        totalCoupons,        // ✅ ADDED
        activeCoupons        // ✅ ADDED
      },
      recentOrders: formattedRecentOrders
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ GET ALL ORDERS
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let filter = {};
    
    if (status && status !== 'all') {
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
    
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.orderId || `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
      user: {
        name: order.userName || order.user?.name || 'Unknown',
        email: order.userEmail || order.user?.email || 'No email'
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        size: item.size,
        price: item.price,
        image: item.image,
        productId: item.product
      })),
      shippingAddress: {
        fullName: order.shippingAddress?.fullName || '',
        phone: order.shippingAddress?.phone || '',
        address: order.shippingAddress?.address || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        pincode: order.shippingAddress?.pincode || '',
        country: order.shippingAddress?.country || 'India'
      },
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      discount: order.discount || 0,
      couponCode: order.couponCode || '',       // ✅ ADDED
      couponDiscount: order.couponDiscount || 0, // ✅ ADDED
      status: order.status,
      paymentStatus: order.paymentStatus,
      utrNumber: order.utrNumber,
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
      carrier: order.carrier || '',
      adminNotes: order.adminNotes || ''
    }));
    
    res.json({
      success: true,
      orders: formattedOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ GET SINGLE ORDER DETAILS
router.get('/orders/:orderId/details', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderId: orderId }
      ]
    }).populate('user', 'name email phone');
    
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
        user: {
          name: order.userName || order.user?.name,
          email: order.userEmail || order.user?.email,
          phone: order.user?.phone || order.shippingAddress?.phone
        },
        items: order.items,
        shippingAddress: order.shippingAddress,
        totalAmount: order.totalAmount,
        discount: order.discount || 0,
        couponCode: order.couponCode || '',       // ✅ ADDED
        couponDiscount: order.couponDiscount || 0, // ✅ ADDED
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        utrNumber: order.utrNumber,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        carrier: order.carrier,
        adminNotes: order.adminNotes,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Order details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching order details',
      error: error.message 
    });
  }
});

// ✅ UPDATE ORDER STATUS - ENHANCED VERSION
router.put('/orders/:orderId/status', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    
    const validStatuses = ['payment_pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderId: orderId }
      ]
    }).populate('user', 'email name');
    
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
      // If COD and delivered, mark payment as collected
      if (order.paymentMethod === 'COD' && order.paymentStatus === 'to_collect') {
        order.paymentStatus = 'collected';
      }
    }
    
    if (notes) {
      order.adminNotes = notes;
    }
    
    await order.save();
    
    // Send email notification
    try {
      await sendOrderStatusUpdate(order);
    } catch (emailError) {
      console.log('Email notification failed:', emailError.message);
    }
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ VERIFY PAYMENT - ENHANCED VERSION for both UPI and COD
router.post('/orders/:orderId/verify-payment', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, utrNumber } = req.body;
    
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderId: orderId }
      ]
    }).populate('user', 'email name');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Handle UPI payments
    if (order.paymentMethod === 'UPI') {
      if (action === 'approve') {
        if (!utrNumber && !order.utrNumber) {
          return res.status(400).json({
            success: false,
            message: 'UTR number is required for UPI payment approval'
          });
        }
        
        order.paymentStatus = 'verified';
        order.utrNumber = utrNumber || order.utrNumber;
        order.status = 'confirmed';
        order.paymentVerifiedAt = new Date();
        
      } else if (action === 'reject') {
        order.paymentStatus = 'failed';
        order.status = 'cancelled';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "approve" or "reject"'
        });
      }
    }
    // Handle COD payments
    else if (order.paymentMethod === 'COD') {
      if (action === 'approve' || action === 'collect') {
        order.paymentStatus = 'collected';
        order.status = 'confirmed';
        order.paymentVerifiedAt = new Date();
      } else if (action === 'reject') {
        order.paymentStatus = 'failed';
        order.status = 'cancelled';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "approve"/"collect" or "reject"'
        });
      }
    }
    
    await order.save();
    
    // Send payment status email
    try {
      await sendPaymentStatus(order);
    } catch (emailError) {
      console.log('Email notification failed:', emailError.message);
    }
    
    res.json({
      success: true,
      message: `Payment ${action}d successfully`,
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        utrNumber: order.utrNumber
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
});

// ✅ EMAIL TEST ROUTE
router.post('/email/test', adminAuth, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(400).json({
        success: false,
        message: 'Email service not configured'
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

    const result = await sendEmail(
      email,
      'orderConfirmation',
      testData
    );

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully'
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

// ✅ GET EMAIL CONFIG
router.get('/email/config', adminAuth, (req, res) => {
  try {
    const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    
    res.json({
      success: true,
      configured: emailConfigured
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ UPLOAD PRODUCT IMAGE ROUTE
router.post('/upload-image', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: fullUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
});

// ✅ DELETE IMAGE ROUTE
router.delete('/delete-image', adminAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image'
    });
  }
});

// ✅ GET PRODUCTS WITH FILTERING
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
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (gender && gender !== 'all' && gender !== '') {
      filter.gender = gender;
    }
    
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      } else if (status === 'featured') {
        filter.featured = true;
      }
    }
    
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ];
    }
    
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
      default:
        sortOption.createdAt = -1;
    }
    
    const skip = (page - 1) * limit;
    
    const products = await Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalProducts = await Product.countDocuments(filter);
    
    res.json({
      success: true,
      products,
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

// ✅ CREATE PRODUCT ROUTE - SIMPLIFIED AND FIXED
router.post('/products', adminAuth, async (req, res) => {
  try {
    console.log('📦 Creating product with data:', req.body);
    
    // ✅ Validate only basic required fields
    const { name, price, category } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }
    
    if (!price || isNaN(price) || Number(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Product category is required'
      });
    }
    
    // ✅ Handle images - accept any image URL or use default
    let images = [];
    if (req.body.images && Array.isArray(req.body.images)) {
      // Filter out empty strings
      images = req.body.images.filter(img => img && typeof img === 'string' && img.trim().length > 0);
    }
    
    // If no images provided, use default
    if (images.length === 0) {
      images = ['https://via.placeholder.com/500x500.png?text=TV+Merch+Product'];
    }
    
    // ✅ Prepare product data with defaults
    const productData = {
      name: name.trim(),
      description: req.body.description || `Product description for ${name}`,
      category: category,
      subCategory: req.body.subCategory || '',
      gender: req.body.gender || '',
      price: Number(price),
      mrp: req.body.mrp ? Number(req.body.mrp) : Number(price),
      discount: req.body.discount ? Number(req.body.discount) : 0,
      quantity: req.body.quantity ? Number(req.body.quantity) : 0,
      images: images,
      sizes: req.body.sizes || [],
      colors: req.body.colors || ['Black'],
      isActive: req.body.isActive !== false,
      featured: req.body.featured || false,
      dealOfDay: req.body.dealOfDay || false,
      specifications: req.body.specifications || {
        material: req.body.material || 'Cotton',
        brand: req.body.brand || 'TV Merchandise',
        washCare: 'Machine wash cold'
      },
      tags: req.body.tags || [],
      showName: req.body.showName || '',
      season: req.body.season || ''
    };

    // Create and save product
    const product = new Product(productData);
    await product.save();
    
    console.log('✅ Product created successfully:', product._id);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: product
    });
    
  } catch (error) {
    console.error('❌ Error creating product:', error);
    
    // Handle duplicate SKU error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists. Please leave SKU blank for auto-generation.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create product' 
    });
  }
});

// ✅ GET SINGLE PRODUCT
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

// ✅ UPDATE PRODUCT
router.put('/products/:productId', adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const productData = req.body;
    
    const product = await Product.findByIdAndUpdate(
      productId,
      { $set: productData },
      { new: true }
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
    res.status(500).json({ 
      success: false, 
      message: 'Error updating product',
      error: error.message 
    });
  }
});

// ✅ DELETE PRODUCT
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

// ✅ USER MANAGEMENT
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ REVIEW MANAGEMENT
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ UPDATE REVIEW STATUS
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ COUPON MANAGEMENT ROUTES

// ✅ GET ALL COUPONS
router.get('/coupons', adminAuth, async (req, res) => {
  try {
    const { 
      status = 'all', 
      search = '', 
      sort = 'newest',
      page = 1, 
      limit = 20 
    } = req.query;
    
    let filter = {};
    
    // Filter by status
    const now = new Date();
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.isActive = true;
        filter.startDate = { $lte: now };
        filter.endDate = { $gte: now };
      } else if (status === 'expired') {
        filter.endDate = { $lt: now };
      } else if (status === 'upcoming') {
        filter.startDate = { $gt: now };
      } else if (status === 'inactive') {
        filter.isActive = false;
      }
    }
    
    // Search filter
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { code: searchRegex },
        { name: searchRegex },
        { description: searchRegex }
      ];
    }
    
    // Sort options
    let sortOption = {};
    switch(sort) {
      case 'newest':
        sortOption.createdAt = -1;
        break;
      case 'oldest':
        sortOption.createdAt = 1;
        break;
      case 'usage-high':
        sortOption.usedCount = -1;
        break;
      case 'usage-low':
        sortOption.usedCount = 1;
        break;
      case 'discount-high':
        sortOption.discountValue = -1;
        break;
      case 'discount-low':
        sortOption.discountValue = 1;
        break;
      default:
        sortOption.createdAt = -1;
    }
    
    const skip = (page - 1) * limit;
    
    const coupons = await Coupon.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCoupons = await Coupon.countDocuments(filter);
    
    res.json({
      success: true,
      coupons,
      pagination: {
        total: totalCoupons,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCoupons / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching coupons',
      error: error.message
    });
  }
});

// ✅ GET COUPON USAGE STATISTICS
router.get('/coupons/stats/usage', adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find({}, 'code name usedCount totalQuantity discountType discountValue')
      .sort({ usedCount: -1 });

    const stats = coupons.map(coupon => ({
      code: coupon.code,
      name: coupon.name,
      used: coupon.usedCount,
      total: coupon.totalQuantity,
      usagePercentage: coupon.totalQuantity > 0 ? 
        ((coupon.usedCount / coupon.totalQuantity) * 100).toFixed(1) : '0.0',
      discountInfo: coupon.discountType === 'percentage' 
        ? `${coupon.discountValue}%` 
        : `₹${coupon.discountValue}`
    }));

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching coupon stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching coupon statistics'
    });
  }
});

// ✅ CREATE NEW COUPON
router.post('/coupons', adminAuth, async (req, res) => {
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

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ 
      code: code.toUpperCase() 
    });
    
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Validate discount value
    if (discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0'
      });
    }

    // Create coupon
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
      isActive: isActive !== false
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error creating coupon',
      error: error.message
    });
  }
});

// ✅ GET SINGLE COUPON
router.get('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }
    
    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching coupon'
    });
  }
});

// ✅ UPDATE COUPON
router.put('/coupons/:id', adminAuth, async (req, res) => {
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

    // Check if coupon exists
    let coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check if code is being changed and if it already exists
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

    // Update fields
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

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error('Error updating coupon:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating coupon',
      error: error.message
    });
  }
});

// ✅ DELETE COUPON
router.delete('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete coupon that has been used'
      });
    }

    await coupon.deleteOne();

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting coupon',
      error: error.message
    });
  }
});

module.exports = router;