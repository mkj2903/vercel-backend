const { sendEmail } = require('./emailService');

// Send order confirmation email
const sendOrderConfirmation = async (orderData) => {
  try {
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { success: false, message: 'No email address found' };
    }

    const result = await sendEmail(
      userEmail,
      'orderConfirmation',
      orderData
    );

    return result;
  } catch (error) {
    console.error('Error sending order confirmation:', error);
    return { success: false, error: error.message };
  }
};

// Send payment status email
const sendPaymentStatus = async (orderData, paymentStatus) => {
  try {
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { success: false, message: 'No email address found' };
    }

    const result = await sendEmail(
      userEmail,
      'paymentStatus',
      orderData,
      { status: paymentStatus }
    );

    return result;
  } catch (error) {
    console.error('Error sending payment status:', error);
    return { success: false, error: error.message };
  }
};

// Send order status update email
const sendOrderStatusUpdate = async (orderData, newStatus) => {
  try {
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email;
    
    if (!userEmail) {
      console.log('⚠️ No email found for order:', orderData.orderId);
      return { success: false, message: 'No email address found' };
    }

    const result = await sendEmail(
      userEmail,
      'orderStatusUpdate',
      orderData,
      { newStatus: newStatus }
    );

    return result;
  } catch (error) {
    console.error('Error sending status update:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderConfirmation,
  sendPaymentStatus,
  sendOrderStatusUpdate,
  sendEmail
};