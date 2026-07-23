const { sendEmail } = require("././util/sendEmail");

async function sendOrderAssignedEmail(
  recipientEmail,
  recipientName,
  orderID,
  deliveryAddress
) {
  if (!recipientEmail) {
    console.warn(
      `No email address available for recipient (order ${orderID}); skipping assignment email.`
    );
    return;
  }

  const subject = `📦 New Order Assigned - Order #${orderID}`;

  try {
    await sendEmail(
      recipientEmail,
      {
        recipientName,
        orderID,
        deliveryAddress,
      },
      subject,
      "order-assigned"  
    );
    console.log(`Order assignment email sent to ${recipientEmail}`);
  } catch (error) {
    console.error(
      `Failed to send order assignment email to ${recipientEmail}:`,
      error
    );
    throw error;
  }
}

module.exports = { sendOrderAssignedEmail };