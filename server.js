const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { testEmailConfig } = require('./utils/emailService');

// Load environment variables
dotenv.config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= ROUTES =================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));

// ================= ROOT =================
app.get('/', (req, res) => {
  res.json({
    message: '🎬 TV Merchandise E-commerce API',
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      coupons: '/api/coupons',
      admin: '/api/admin',
      health: '/health',
      apiHealth: '/api/health',
      uploads: '/uploads/:filename'
    },
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// ================= EMAIL =================
app.post('/api/email/test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.json({ success: false, message: 'Email not configured' });
    }

    const { sendEmail } = require('./utils/emailController');

    const result = await sendEmail(email, 'orderConfirmation', {
      orderId: 'TEST-' + Date.now(),
      userName: 'Test User',
      userEmail: email,
      totalAmount: 1999,
      createdAt: new Date(),
      shippingAddress: { fullName: 'Test User', city: 'Mumbai', country: 'India' },
      items: [{ name: 'TV Show T-Shirt', quantity: 1, price: 999 }],
      utrNumber: 'TEST123'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= HEALTH =================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailConfigured: !!process.env.EMAIL_USER
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ================= DATABASE INIT =================
const initializeDatabase = async () => {
  try {
    const Product = require('./models/Product');

    const count = await Product.countDocuments();
    if (count === 0) {
      await Product.insertMany([
        {
          name: 'TV Show Fan T-Shirt',
          category: 't-shirts',
          price: 599,
          quantity: 100,
          sizes: ['S', 'M', 'L', 'XL']
        }
      ]);
      console.log('✅ Sample product added');
    }
  } catch (err) {
    console.error('DB init error:', err.message);
  }
};

// ================= DB CONNECT =================
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI missing in .env');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await initializeDatabase();
  })
  .catch(err => {
    console.error('❌ Mongo error:', err.message);
    process.exit(1);
  });

// ================= ERRORS =================
app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: err.message });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
