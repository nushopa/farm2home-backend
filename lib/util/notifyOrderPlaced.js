// lib/util/notifyOrderPlaced.js
const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const Notification = require("../../models/Notification");
const { notifyAdminAction } = require("./deliverNotification");
const { sendPushNotification } = require("./sendPush");
const { sendOrderConfirmationEmail } = require("../sendOrderEmail");

const naira = (n) => `\u20a6${(Number(n) || 0).toLocaleString("en-NG")}`;

async function notifyOrderPlaced(io, order) {
  const orderID = order.orderID;
  const customer = await Customer.findById(order.customer_id)
    .select("_id email first_name last_name").lean();

  const productIds = order.products.map((p) => p.product_id?._id ?? p.product_id);
  const products = await Product.find({
    _id: { $in: productIds },
  }).select("product_name product_price").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items = order.products.map((p) => {
    const productId = p.product_id?._id ?? p.product_id;
    const prod = byId.get(String(productId));
    const quantity = parseInt(p.product_quatity) || 0;
    const price = prod?.product_price ?? 0;
    return { name: prod?.product_name || "Item", quantity, price, lineTotal: price * quantity };
  });

  const summary = `${items.map((i) => `${i.quantity}x ${i.name}`).join(", ")} \u2022 Total ${naira(order.amount_paid)} \u2022 Delivery code ${order.delivery_code}`;

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
        metadata: { items, total: order.amount_paid, deliveryCode: order.delivery_code },
      });
      io.to(`customer_${order.customer_id}`).emit("notification", n);
      await sendPushNotification({
        userId: order.customer_id, title: "Order placed! \ud83c\udf89", body: summary,
        data: { type: "order-placed", orderId: orderID, notificationId: n._id.toString() },
        kind: "transactional",
      });
    })(),
    // customer email (with prices)
    sendOrderConfirmationEmail(
      order.address?.first_name || customer?.first_name,
      order.address?.email || customer?.email,
      order.delivery_code,
      orderID,
    ),
  ];

  (await Promise.allSettled(tasks)).forEach((r, i) => {
    if (r.status === "rejected") console.error(`notifyOrderPlaced task ${i} failed:`, r.reason);
  });
}
module.exports = { notifyOrderPlaced };