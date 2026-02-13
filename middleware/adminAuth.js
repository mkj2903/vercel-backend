const adminAuth = (req, res, next) => {
  try {
    console.log('Admin auth middleware called');
    
    // Get token from header (multiple formats support)
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    } else if (req.headers.authorization) {
      token = req.headers.authorization;
    }
    
    console.log('Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No admin token provided. Please login again.'
      });
    }
    
    // Simple token validation (you can replace with JWT verification)
    if (token.startsWith('admin-token-')) {
      req.admin = { 
        isAdmin: true,
        email: process.env.ADMIN_EMAIL || 'admin@tvmerch.com'
      };
      console.log('Admin authentication successful');
      next(); // ✅ FIXED: Correctly call next() function
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token. Token format should start with "admin-token-"'
      });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication server error',
      error: error.message
    });
  }
};

module.exports = { adminAuth };