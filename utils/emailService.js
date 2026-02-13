const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test email configuration
const testEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email service not configured');
      return { success: false, message: 'Email service not configured' };
    }
    
    await transporter.verify();
    console.log('✅ Email server is ready');
    return { success: true, message: 'Email server is ready' };
  } catch (error) {
    console.error('❌ Email config error:', error.message);
    return { 
      success: false, 
      message: 'Email configuration error',
      error: error.message 
    };
  }
};

// ✅ FIXED: Email templates with proper data handling
const emailTemplates = {
  // Order Confirmation
  orderConfirmation: (orderData) => {
    // Ensure all required data exists
    const orderId = orderData.orderId || 'ORD-XXXXXX';
    const userName = orderData.userName || orderData.shippingAddress?.fullName || 'Customer';
    const userEmail = orderData.userEmail || orderData.shippingAddress?.email || '';
    const totalAmount = orderData.totalAmount || 0;
    const paymentMethod = orderData.paymentMethod || 'UPI';
    const utrNumber = orderData.utrNumber || '';
    const createdAt = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
    
    const shippingAddress = orderData.shippingAddress || {};
    const items = orderData.items || [];
    
    return {
      subject: `🎉 Order Confirmed - ${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
            .item-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .total { font-size: 18px; font-weight: bold; color: #2563eb; }
            .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Order Confirmed!</h1>
            <p>Thank you for shopping with TV Merchandise</p>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We've received your order and it's being processed. Here are your order details:</p>
            
            <div class="order-details">
              <h3>Order Information</h3>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Order Date:</strong> ${createdAt.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>Status:</strong> <span class="status status-pending">Payment Verification</span></p>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
              ${paymentMethod === 'UPI' && utrNumber ? `<p><strong>UTR Number:</strong> ${utrNumber}</p>` : ''}
              
              <h3>Shipping Address</h3>
              <p>${shippingAddress.fullName || userName}</p>
              <p>${shippingAddress.address || 'Address not specified'}</p>
              <p>${shippingAddress.city || ''}, ${shippingAddress.state || ''} - ${shippingAddress.pincode || ''}</p>
              <p>${shippingAddress.country || 'India'}</p>
              
              <h3>Order Items</h3>
              ${items.map(item => `
                <div class="item-row">
                  <div>
                    <strong>${item.name || 'Product'}</strong><br>
                    <small>Size: ${item.size || 'One Size'} | Qty: ${item.quantity || 1}</small>
                  </div>
                  <div>₹${(item.price || 0) * (item.quantity || 1)}</div>
                </div>
              `).join('')}
              
              <div style="text-align: right; margin-top: 20px; border-top: 2px solid #2563eb; padding-top: 10px;">
                <p class="total">Total Amount: ₹${totalAmount}</p>
              </div>
            </div>
            
            <h3>Next Steps</h3>
            ${paymentMethod === 'COD' 
              ? `<p>Your COD order has been confirmed. You will pay ₹${totalAmount} when the order arrives.</p>`
              : `<p>Please complete your payment via UPI. Our admin will verify your payment within 1-2 hours.</p>`
            }
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5173/my-orders" class="button">
                Track Your Order
              </a>
            </div>
            
            <div class="footer">
              <p>Need help? Contact us at support@tvmerch.com</p>
              <p>© ${new Date().getFullYear()} TV Merchandise. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  // Payment Status Update
  paymentStatus: (orderData, status) => {
    const orderId = orderData.orderId || 'ORD-XXXXXX';
    const userName = orderData.userName || 'Customer';
    const totalAmount = orderData.totalAmount || 0;
    const utrNumber = orderData.utrNumber || '';
    
    const statusInfo = {
      verified: {
        subject: `✅ Payment Verified - ${orderId}`,
        title: 'Payment Verified Successfully!',
        message: 'Your payment has been verified and your order is now being processed.',
        statusClass: 'status-confirmed',
        statusText: 'Payment Verified',
        color: '#10b981'
      },
      failed: {
        subject: `❌ Payment Rejected - ${orderId}`,
        title: 'Payment Rejected',
        message: 'Your payment has been rejected. Please check the UTR number and try again.',
        statusClass: 'status-pending',
        statusText: 'Payment Rejected',
        color: '#ef4444'
      },
      collected: {
        subject: `✅ COD Collected - ${orderId}`,
        title: 'COD Payment Collected!',
        message: 'Your COD payment has been collected and order is confirmed.',
        statusClass: 'status-confirmed',
        statusText: 'COD Collected',
        color: '#10b981'
      }
    };
    
    const info = statusInfo[status] || statusInfo.verified;
    
    return {
      subject: info.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${info.color}, ${info.color}99); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .status-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #e5e7eb; }
            .status { display: inline-block; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; }
            .status-confirmed { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fee2e2; color: #991b1b; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${info.title}</h1>
              <p>Order ${orderId}</p>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>${info.message}</p>
              
              <div class="status-box">
                <h3>Payment Status</h3>
                <div class="status ${info.statusClass}">${info.statusText}</div>
                <p style="margin-top: 15px;">
                  <strong>Order ID:</strong> ${orderId}<br>
                  <strong>Amount:</strong> ₹${totalAmount}<br>
                  ${utrNumber ? `<strong>UTR Number:</strong> ${utrNumber}<br>` : ''}
                  <strong>Updated:</strong> ${new Date().toLocaleString('en-IN')}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5173/my-orders" class="button">
                  View Your Orders
                </a>
              </div>
              
              <div class="footer">
                <p>Thank you for shopping with TV Merchandise</p>
                <p>© ${new Date().getFullYear()} TV Merchandise. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  // Order Status Update
  orderStatusUpdate: (orderData, newStatus) => {
    const orderId = orderData.orderId || 'ORD-XXXXXX';
    const userName = orderData.userName || 'Customer';
    
    const statusConfig = {
      processing: {
        subject: `🔄 Order Processing - ${orderId}`,
        title: 'Order is Being Processed',
        message: 'We\'re preparing your order for shipment.',
        color: '#f59e0b'
      },
      shipped: {
        subject: `🚚 Order Shipped - ${orderId}`,
        title: 'Your Order Has Shipped!',
        message: 'Your order is on the way to you.',
        color: '#3b82f6'
      },
      delivered: {
        subject: `🎊 Order Delivered - ${orderId}`,
        title: 'Order Delivered Successfully!',
        message: 'Your order has been delivered.',
        color: '#10b981'
      },
      cancelled: {
        subject: `❌ Order Cancelled - ${orderId}`,
        title: 'Order Has Been Cancelled',
        message: 'Your order has been cancelled as per your request.',
        color: '#ef4444'
      }
    };
    
    const config = statusConfig[newStatus] || statusConfig.processing;
    
    return {
      subject: config.subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${config.color}, ${config.color}99); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.title}</h1>
              <p>Order ${orderId}</p>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>${config.message}</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <h3>Order Status Update</h3>
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>New Status:</strong> <span style="color: ${config.color}; font-weight: bold;">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</span></p>
                <p><strong>Updated On:</strong> ${new Date().toLocaleString('en-IN')}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5173/my-orders" class="button">
                  View Order Details
                </a>
              </div>
              
              <div class="footer">
                <p>Thank you for choosing TV Merchandise!</p>
                <p>© ${new Date().getFullYear()} TV Merchandise. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }
};

// ✅ FIXED: Send email function with better error handling
const sendEmail = async (to, templateName, data, additionalInfo = {}) => {
  try {
    // Check if email is enabled
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email service not configured');
      return { 
        success: false, 
        message: 'Email service not configured',
        error: 'EMAIL_USER or EMAIL_PASS not set in environment variables'
      };
    }

    // Get template
    let template;
    if (templateName === 'orderConfirmation') {
      template = emailTemplates.orderConfirmation(data);
    } else if (templateName === 'paymentStatus') {
      template = emailTemplates.paymentStatus(data, additionalInfo.status);
    } else if (templateName === 'orderStatusUpdate') {
      template = emailTemplates.orderStatusUpdate(data, additionalInfo.newStatus);
    } else {
      return { 
        success: false, 
        message: 'Invalid template name',
        error: `Template '${templateName}' not found`
      };
    }

    // Prepare email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"TV Merchandise" <noreply@tvmerch.com>',
      to: to,
      subject: template.subject,
      html: template.html,
      replyTo: process.env.EMAIL_REPLY_TO || 'support@tvmerch.com'
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent to ${to}: ${template.subject}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      to: to,
      subject: template.subject,
      message: 'Email sent successfully'
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.error('Email error details:', error);
    
    return { 
      success: false, 
      error: error.message,
      to: to,
      message: 'Failed to send email'
    };
  }
};

module.exports = {
  transporter,
  testEmailConfig,
  sendEmail,
  emailTemplates
};