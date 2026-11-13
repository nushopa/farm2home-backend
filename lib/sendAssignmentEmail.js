const { sendEmail } = require("./util/sendEmail");
const {
  buildOrderEmailDetails,
  formatAddress,
  formatNaira,
} = require("./util/orderEmailDetails");

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

async function sendDetailedOrderAssignedEmail(order, recipient, recipientRole) {
  const recipientEmail = recipient?.email;
  const recipientName =
    recipient?.first_name ||
    recipient?.firstName ||
    recipient?.business_name ||
    "Team member";
  if (!recipientEmail) {
    console.warn(
      `No email address available for ${recipientRole} (order ${order.orderID}); skipping assignment email.`,
    );
    return;
  }

  const details = await buildOrderEmailDetails(order);
  const customerName =
    [
      order.address?.first_name || details.customer?.first_name,
      order.address?.last_name || details.customer?.last_name,
    ]
      .filter(Boolean)
      .join(" ") || "Customer";
  const data = {
    recipientName,
    recipientRole,
    orderID: order.orderID,
    deliveryAddress: details.deliveryAddress || formatAddress(order.address),
    deliveryMode:
      details.deliveryMode === "fast" ? "Fast delivery" : "Standard delivery",
    customerName,
    customerPhone:
      order.address?.phone_number || details.customer?.phone_number || "Not provided",
    items: details.items.map((item) => ({
      ...item,
      unitPrice: formatNaira(item.price),
      lineTotalFormatted: formatNaira(item.lineTotal),
    })),
    subtotal: formatNaira(details.subtotal),
    deliveryFee: formatNaira(details.deliveryFee),
    serviceFee: formatNaira(details.serviceFee),
    amountPaid: formatNaira(details.amountPaid),
  };

  try {
    await sendEmail(
      recipientEmail,
      data,
      `Order ${order.orderID} assigned to you`,
      "order-assigned",
    );
    console.log(`Detailed order assignment email sent to ${recipientEmail}`);
  } catch (error) {
    console.error(
      `Failed to send detailed order assignment email to ${recipientEmail}:`,
      error,
    );
    throw error;
  }
}

module.exports = { sendOrderAssignedEmail, sendDetailedOrderAssignedEmail };