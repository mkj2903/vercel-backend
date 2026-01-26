const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { testEmailConfig } = require('./utils/emailService');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🎬 TV Merchandise E-commerce API',
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      admin: '/api/admin',
      health: '/health'
    },
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// ✅ ADDED: Email test endpoint
app.post('/api/email/test', async (req, res) => {
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
      return res.json({
        success: false,
        message: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS in .env file'
      });
    }

    const { sendEmail } = require('./utils/emailController');
    
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
    res.status(500).json({ 
      success: false, 
      message: 'Error sending test email',
      error: error.message 
    });
  }
});

// ✅ ADDED: Email configuration check
app.get('/api/email/config', (req, res) => {
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

// ✅ UPDATED: Health check endpoint with email status
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// ✅ UPDATED: Health check for /api/health
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// Test email configuration on startup
try {
  testEmailConfig();
} catch (error) {
  console.log('⚠️ Email service not configured');
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mohitjangra:mohitjangra@tv-merch-cluster.lqjsd3a.mongodb.net/tv-merch';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    
    // Initialize database
    initializeDatabase();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// Initialize database
const initializeDatabase = async () => {
  try {
    const Product = require('./models/Product');
    const User = require('./models/User');
    
    // Check if products exist
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('📦 Adding sample products...');
      
      const sampleProducts = [
        {
          name: 'TV Show Fan T-Shirt',
          description: 'Official merchandise T-shirt for TV show fans',
          category: 't-shirts',
          price: 599,
          images: ['https://via.placeholder.com/300x400/2563eb/ffffff?text=TV+Show+T-Shirt'],
          featured: true,
          quantity: 100,
          sizes: ['S', 'M', 'L', 'XL']
        },
        {
          name: 'TV Show Coffee Mug',
          description: 'Premium ceramic coffee mug with TV show design',
          category: 'mugs',
          price: 299,
          images: ['https://via.placeholder.com/300x400/10b981/ffffff?text=TV+Show+Mug'],
          featured: true,
          quantity: 150
        }
      ];
      
      await Product.insertMany(sampleProducts);
      console.log('✅ Sample products added');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🛒 API base: http://localhost:${PORT}/api`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? '✅ Configured' : '❌ Not configured'}`);
  console.log('========================================');
});