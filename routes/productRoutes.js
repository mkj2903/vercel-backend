// backend/routes/productRoutes.js - UPDATED WITH DEAL OF DAY ENDPOINT
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get all products (Public)
router.get('/', async (req, res) => {
  try {
    const { category, featured, dealOfDay, limit = 20, page = 1, _t } = req.query;
    let filter = {};
    
    console.log('Product request received:', {
      category,
      featured,
      dealOfDay,
      limit,
      page,
      timestamp: _t
    });
    
    if (category && category !== 'all') {
      filter.category = category;
      console.log('Filtering by category:', category);
    }
    
    if (featured === 'true') {
      filter.featured = true;
    }
    
    // ✅ NEW: Filter by deal of the day
    if (dealOfDay === 'true') {
      filter.dealOfDay = true;
      // Also filter out expired deals
      filter.$or = [
        { dealExpiry: { $eq: null } },
        { dealExpiry: { $gt: new Date() } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    console.log('MongoDB filter:', filter);
    
    const products = await Product.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const totalProducts = await Product.countDocuments(filter);
    
    console.log(`Found ${products.length} products, total: ${totalProducts}`);
    
    res.json({
      success: true,
      products,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: parseInt(page),
      totalProducts
    });
  } catch (error) {
    console.error('Error in products route:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single product (Public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get products by category (Public) - ✅ ENHANCED
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log('Category endpoint called for:', category);
    
    const products = await Product.find({ 
      category: { $regex: new RegExp(category, 'i') } 
    });
    
    console.log(`Found ${products.length} products for category: ${category}`);
    
    res.json({
      success: true,
      products,
      count: products.length,
      category: category
    });
  } catch (error) {
    console.error('Error in category route:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get featured products (Public)
router.get('/featured/products', async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).limit(8);
    
    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Get Deal of the Day products
router.get('/deal-of-the-day/products', async (req, res) => {
  try {
    const products = await Product.find({ 
      dealOfDay: true,
      $or: [
        { dealExpiry: { $eq: null } },
        { dealExpiry: { $gt: new Date() } }
      ]
    }).limit(8);
    
    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching deal of the day products:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      products: [] 
    });
  }
});

// ✅ NEW: Get trending products (by sales)
router.get('/trending/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ salesCount: -1 })
      .limit(8);
    
    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Get best seller products
router.get('/best-sellers/products', async (req, res) => {
  try {
    const products = await Product.find({ 
      isBestSeller: true,
      isActive: true 
    }).limit(8);
    
    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search products (Public)
router.get('/search/products', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        products: [],
        count: 0
      });
    }
    
    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { showName: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ]
    }).limit(20);
    
    res.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ ADDED: Get product categories for filtering
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    
    res.json({
      success: true,
      categories,
      count: categories.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ ADDED: Get product statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const featuredProducts = await Product.countDocuments({ featured: true });
    const dealOfDayProducts = await Product.countDocuments({ 
      dealOfDay: true,
      $or: [
        { dealExpiry: { $eq: null } },
        { dealExpiry: { $gt: new Date() } }
      ]
    });
    const lowStockProducts = await Product.countDocuments({ 
      quantity: { $lt: 10, $gt: 0 } 
    });
    const outOfStockProducts = await Product.countDocuments({ 
      quantity: 0 
    });
    
    res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        featuredProducts,
        dealOfDayProducts,
        lowStockProducts,
        outOfStockProducts
      }
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ ADDED: Health check for product routes
router.get('/health/check', (req, res) => {
  res.json({
    success: true,
    message: 'Product routes are working',
    endpoints: [
      'GET / - Get all products',
      'GET /category/:category - Get products by category',
      'GET /featured/products - Get featured products',
      'GET /deal-of-the-day/products - Get deal of the day products',
      'GET /trending/products - Get trending products',
      'GET /best-sellers/products - Get best seller products',
      'GET /search/products - Search products',
      'GET /categories/all - Get all categories',
      'GET /stats/summary - Get product statistics',
      'GET /:id - Get single product'
    ]
  });
});

module.exports = router;