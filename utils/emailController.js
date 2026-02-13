const { sendEmail } = require('./emailService');

// ✅ SIMPLIFIED: Send order confirmation email
const sendOrderConfirmation = async (orderData) => {
  try {
    const userEmail = orderData.userEmail;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { 
        success: false, 
        message: 'No email address found',
        orderId: orderData.orderId 
      };
    }

    console.log(`📧 Sending order confirmation to: ${userEmail}`);
    
    const result = await sendEmail(
      userEmail,
      'orderConfirmation',
      orderData
    );

    return result;
  } catch (error) {
    console.error('❌ Error sending order confirmation:', error);
    return { 
      success: false, 
      error: error.message,
      message: 'Failed to send email'
    };
  }
};

// ✅ Send payment status email
const sendPaymentStatus = async (orderData, paymentStatus) => {
  try {
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { 
        success: false, 
        message: 'No email address found',
        orderId: orderData.orderId 
      };
    }

    console.log(`📧 Sending payment status to: ${userEmail}`);
    console.log(`📦 Order ID: ${orderData.orderId}, Status: ${paymentStatus}`);
    
    const result = await sendEmail(
      userEmail,
      'paymentStatus',
      orderData,
      { status: paymentStatus }
    );

    return result;
  } catch (error) {
    console.error('❌ Error sending payment status:', error);
    return { 
      success: false, 
      error: error.message,
      message: 'Failed to send payment status email'
    };
  }
};

// ✅ Send order status update email
const sendOrderStatusUpdate = async (orderData, newStatus) => {
  try {
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { 
        success: false, 
        message: 'No email address found',
        orderId: orderData.orderId 
      };
    }

    console.log(`📧 Sending order status update to: ${userEmail}`);
    console.log(`📦 Order ID: ${orderData.orderId}, New Status: ${newStatus}`);
    
    const result = await sendEmail(
      userEmail,
      'orderStatusUpdate',
      orderData,
      { newStatus: newStatus }
    );

    return result;
  } catch (error) {
    console.error('❌ Error sending status update:', error);
    return { 
      success: false, 
      error: error.message,
      message: 'Failed to send order status update email'
    };
  }
};

// ✅ Test email endpoint
const testEmail = async (email) => {
  try {
    console.log('📧 Testing email configuration...');
    
    if (!email) {
      return { 
        success: false, 
        message: 'Email is required' 
      };
    }

    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return { 
        success: false, 
        message: 'Email service is not configured. Please set EMAIL_USER and EMAIL_PASS in .env file' 
      };
    }

    // Create test order data
    const testData = {
      orderId: 'TEST-' + Date.now().toString().slice(-6),
      userName: 'Test User',
      userEmail: email,
      totalAmount: 1999,
      subtotalAmount: 2000,
      handlingCharge: 0,
      discount: 10,
      deliveryCharge: 9,
      createdAt: new Date(),
      shippingAddress: {
        fullName: 'Test User',
        address: '123 Test Street, Test Area',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India'
      },
      items: [
        { 
          name: 'Breaking Bad T-Shirt', 
          size: 'L', 
          quantity: 1, 
          price: 899,
          image: 'https://via.placeholder.com/150'
        },
        { 
          name: 'Game of Thrones Mug', 
          size: 'One Size', 
          quantity: 2, 
          price: 299,
          image: 'https://via.placeholder.com/150'
        }
      ],
      paymentMethod: 'UPI',
      utrNumber: 'TEST123456789',
      status: 'payment_pending',
      paymentStatus: 'pending'
    };

    console.log(`📧 Sending test email to: ${email}`);
    
    const result = await sendEmail(
      email,
      'orderConfirmation',
      testData
    );

    return result;
  } catch (error) {
    console.error('❌ Error in test email:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send test email' 
    };
  }
};

module.exports = {
  sendOrderConfirmation,
  sendPaymentStatus,
  sendOrderStatusUpdate,
  testEmail,
  sendEmail
};