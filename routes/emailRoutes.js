const express = require('express');
const router = express.Router();
const { testEmail } = require('../utils/emailController');
const { adminAuth } = require('../middleware/adminAuth');

// Test email endpoint (admin only)
router.post('/test', adminAuth, testEmail);

// Get email configuration status
router.get('/config', adminAuth, async (req, res) => {
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

module.exports = router;