const express = require('express');
const router = express.Router();
const User = require('../models/User');

// User registration
router.post('/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({
        success: true,
        message: 'User already exists',
        user: existingUser
      });
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      role: 'user'
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const email = req.query.email;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({
        success: false,
        message: 'User not found',
        user: null
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Google login
router.post('/google', async (req, res) => {
  try {
    const { token, name, email, photoURL } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        photoURL,
        role: 'user'
      });
      await user.save();
    } else {
      // Update existing user
      user.name = name;
      user.photoURL = photoURL;
      await user.save();
    }
    
    res.json({
      success: true,
      message: 'Login successful',
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;