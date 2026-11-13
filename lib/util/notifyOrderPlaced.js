// lib/util/notifyOrderPlaced.js
const Notification = require("../../models/Notification");
const { notifyAdminAction } = require("./deliverNotification");
const { sendPushNotification } = require("./sendPush");
const { sendOrderConfirmationEmail } = require("../sendOrderEmail");
const { buildOrderEmailDetails, formatNaira } = require("./orderEmailDetails");

async function notifyOrderPlaced(io, order) {
  const orderID = order.orderID;
  const details = await buildOrderEmailDetails(order);
  const { customer, items } = details;
  const summary = `${items
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ")} • Total ${formatNaira(details.amountPaid)} • Delivery code ${order.delivery_code}`;

  const tasks = [
    // admins
    notifyAdminAction(io, {
      category: "order", orderId: orderID,
      title: "A new order has been placed",
      message: `${customer?.first_name || "A customer"} ${customer?.last_name || ""} placed order ${orderID}.`.trim(),
      metadata: { customerId: String(order.customer_id) },
      channels: ["push", "email"],
    }),
    // customer in-app + push
    (async () => {
      const n = await Notification.create({
        category: "order_placed", orderId: orderID, customer_id: order.customer_id,
        title: "Order confirmed \ud83c\udf89", message: summary,
        metadata: {
          items,
          total: details.amountPaid,
          deliveryCode: order.delivery_code,
        },
      });
      if (io) io.to(`customer_${order.customer_id}`).emit("notification", n);
      await sendPushNotification({
        userId: order.customer_id, title: "Order placed! \ud83c\udf89", body: summary,
        data: { type: "order-placed", orderId: orderID, notificationId: n._id.toString() },
        kind: "transactional",
      });
    })(),
    // customer email (with prices)
    sendOrderConfirmationEmail({
      customerFirstName:
        order.address?.first_name || customer?.first_name || "Customer",
      customerEmail: order.address?.email || customer?.email,
      orderID,
      deliveryCode: order.delivery_code,
      items,
      subtotal: details.subtotal,
      deliveryFee: details.deliveryFee,
      serviceFee: details.serviceFee,
      amountPaid: details.amountPaid,
      deliveryMode: details.deliveryMode,
      deliveryAddress: details.deliveryAddress,
    }),
  ];

  (await Promise.allSettled(tasks)).forEach((r, i) => {
    if (r.status === "rejected") console.error(`notifyOrderPlaced task ${i} failed:`, r.reason);
  });
}
module.exports = { notifyOrderPlaced };