const nodemailer = require('nodemailer');
require('dotenv').config();  // ✅ ADD THIS LINE

// Create transporter with explicit configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },
  tls: {
    rejectUnauthorized: false  // ✅ ADD THIS LINE
  }
});

// ✅ ADD THIS: Check credentials on startup
console.log('📧 Email Configuration Check:');
console.log('   Host:', process.env.EMAIL_HOST || 'Not set');
console.log('   User:', process.env.EMAIL_USER || 'Not set');
console.log('   Pass Set:', process.env.EMAIL_PASS ? '✅ Yes' : '❌ No');

// Test email configuration
const testEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env');
      return false;
    }
    
    await transporter.verify();
    console.log('✅ Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
    return false;
  }
};

// ... rest of the code remains same ...

// Email templates
const emailTemplates = {
  // Order Confirmation
  orderConfirmation: (orderData) => ({
    subject: `🎉 Order Confirmed - ${orderData.orderId || 'TV Merch Order'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
          .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .total { font-size: 18px; font-weight: bold; color: #2563eb; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-confirmed { background: #d1fae5; color: #065f46; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Order Confirmed!</h1>
            <p>Thank you for shopping with TV Merchandise</p>
          </div>
          <div class="content">
            <h2>Hello ${orderData.userName},</h2>
            <p>We've received your order and it's being processed. Here are your order details:</p>
            
            <div class="order-details">
              <h3>Order Information</h3>
              <p><strong>Order ID:</strong> ${orderData.orderId || 'N/A'}</p>
              <p><strong>Order Date:</strong> ${new Date(orderData.createdAt).toLocaleDateString()}</p>
              <p><strong>Status:</strong> <span class="status status-pending">Payment Pending</span></p>
              
              <h3>Shipping Address</h3>
              <p>${orderData.shippingAddress.fullName}</p>
              <p>${orderData.shippingAddress.address}</p>
              <p>${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} - ${orderData.shippingAddress.pincode}</p>
              <p>${orderData.shippingAddress.country}</p>
              
              <h3>Order Items</h3>
              ${orderData.items.map(item => `
                <div class="item">
                  <div>
                    <strong>${item.name}</strong><br>
                    <small>Size: ${item.size} | Qty: ${item.quantity}</small>
                  </div>
                  <div>₹${item.price * item.quantity}</div>
                </div>
              `).join('')}
              
              <div style="text-align: right; margin-top: 20px; border-top: 2px solid #2563eb; padding-top: 10px;">
                <p class="total">Total Amount: ₹${orderData.totalAmount}</p>
              </div>
            </div>
            
            <h3>Payment Instructions</h3>
            <p>Please complete your payment via UPI to confirm your order. Use the following details:</p>
            <p><strong>UPI ID:</strong> tvmerch@ybl</p>
            <p><strong>Amount:</strong> ₹${orderData.totalAmount}</p>
            <p>After payment, enter your 12-digit UTR number on the order tracking page.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5173/my-orders" 
                 style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Track Your Order
              </a>
            </div>
            
            <p>We'll notify you once your payment is verified and order is shipped.</p>
            
            <div class="footer">
              <p>Need help? Contact us at support@tvmerch.com</p>
              <p>© ${new Date().getFullYear()} TV Merchandise. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Payment Status Update
  paymentStatus: (orderData, status) => {
    const statusInfo = {
      verified: {
        subject: `✅ Payment Verified - ${orderData.orderId}`,
        title: 'Payment Verified Successfully!',
        message: 'Your payment has been verified and your order is now being processed.',
        statusClass: 'status-confirmed',
        statusText: 'Payment Verified'
      },
      failed: {
        subject: `❌ Payment Rejected - ${orderData.orderId}`,
        title: 'Payment Rejected',
        message: 'Your payment has been rejected. Please check the UTR number and try again.',
        statusClass: 'status-pending',
        statusText: 'Payment Rejected'
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
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${status === 'verified' ? '#10b981' : '#ef4444'}, ${status === 'verified' ? '#059669' : '#dc2626'}); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .status-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #e5e7eb; }
            .status { display: inline-block; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; }
            .status-confirmed { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fee2e2; color: #991b1b; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${info.title}</h1>
              <p>Order ${orderData.orderId}</p>
            </div>
            <div class="content">
              <h2>Hello ${orderData.userName},</h2>
              <p>${info.message}</p>
              
              <div class="status-box">
                <h3>Payment Status</h3>
                <div class="status ${info.statusClass}">${info.statusText}</div>
                <p style="margin-top: 15px;">
                  <strong>Order ID:</strong> ${orderData.orderId}<br>
                  <strong>Amount:</strong> ₹${orderData.totalAmount}<br>
                  <strong>UTR Number:</strong> ${orderData.utrNumber || 'Not provided'}<br>
                  <strong>Updated:</strong> ${new Date().toLocaleString()}
                </p>
              </div>
              
              <div class="details">
                <h3>Next Steps</h3>
                ${status === 'verified' 
                  ? `<p>Your order is now confirmed and will be processed soon. You'll receive another email when your order ships.</p>`
                  : `<p>Please check your UTR number and try the payment again. If the issue persists, contact our support team.</p>`
                }
                
                <h3>Need Help?</h3>
                <p>If you have any questions about your payment, please contact our support team:</p>
                <ul>
                  <li>Email: support@tvmerch.com</li>
                  <li>Phone: +91 9876543210</li>
                  <li>Hours: 9 AM - 6 PM (Monday to Saturday)</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5173/my-orders" 
                   style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
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
    const statusConfig = {
      processing: {
        subject: `🔄 Order Processing - ${orderData.orderId}`,
        title: 'Order is Being Processed',
        message: 'We\'re preparing your order for shipment.',
        color: '#f59e0b'
      },
      shipped: {
        subject: `🚚 Order Shipped - ${orderData.orderId}`,
        title: 'Your Order Has Shipped!',
        message: 'Your order is on the way to you.',
        color: '#3b82f6'
      },
      delivered: {
        subject: `🎊 Order Delivered - ${orderData.orderId}`,
        title: 'Order Delivered Successfully!',
        message: 'Your order has been delivered.',
        color: '#10b981'
      },
      cancelled: {
        subject: `❌ Order Cancelled - ${orderData.orderId}`,
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
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${config.color}, ${config.color}99); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.title}</h1>
              <p>Order ${orderData.orderId}</p>
            </div>
            <div class="content">
              <h2>Hello ${orderData.userName},</h2>
              <p>${config.message}</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <h3>Order Status Update</h3>
                <p><strong>Order ID:</strong> ${orderData.orderId}</p>
                <p><strong>New Status:</strong> <span style="color: ${config.color}; font-weight: bold;">${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</span></p>
                <p><strong>Updated On:</strong> ${new Date().toLocaleString()}</p>
                
                ${newStatus === 'shipped' && orderData.trackingNumber ? `
                  <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <h4>📦 Tracking Information</h4>
                    <p><strong>Tracking Number:</strong> ${orderData.trackingNumber}</p>
                    <p><strong>Carrier:</strong> ${orderData.carrier || 'Standard Delivery'}</p>
                  </div>
                ` : ''}
                
                ${newStatus === 'delivered' ? `
                  <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <h4>✅ Delivery Confirmed</h4>
                    <p>Your order has been successfully delivered. We hope you love your TV merchandise!</p>
                  </div>
                ` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:5173/my-orders" 
                   style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
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

// Send email function
const sendEmail = async (to, templateName, data, additionalInfo = {}) => {
  try {
    // Check if email is enabled
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email service not configured. Skipping email to:', to);
      return { success: false, message: 'Email service not configured' };
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
      throw new Error('Invalid template name');
    }

    // Prepare recipients
    const recipients = [to];
    if (process.env.EMAIL_BCC) {
      recipients.push(process.env.EMAIL_BCC);
    }

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"TV Merchandise" <noreply@tvmerch.com>',
      to: recipients.join(', '),
      subject: template.subject,
      html: template.html
    });

    console.log(`✅ Email sent to ${to}: ${template.subject}`);
    console.log(`   Message ID: ${info.messageId}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      to: to,
      subject: template.subject 
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return { 
      success: false, 
      error: error.message,
      to: to 
    };
  }
};

module.exports = {
  transporter,
  testEmailConfig,
  sendEmail,
  emailTemplates
};