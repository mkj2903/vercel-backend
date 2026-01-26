const adminAuth = (req, res, next) => {
  // Simple token check for now
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No admin token provided'
    });
  }
  
  // For now, accept any token that starts with 'admin-token-'
  if (token.startsWith('admin-token-')) {
    next();
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid admin token'
    });
  }
};

module.exports = { adminAuth };