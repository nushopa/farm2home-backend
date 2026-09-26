const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const Customer = require("../models/Customer");
const Distributor = require("../models/Distributor");
const { authMiddleware } = require("../middleware/authMiddleware");
const crypto = require("crypto");
const { sendOrderConfirmationEmail } = require("../lib/sendOrderEmail");
const { sendOrderAssignedEmail } = require("../lib/sendAssignmentEmail");
const { sendPushNotification } = require("../lib/util/sendPush");

function getProductPrice(product) {
  return product?.product_price ?? 0;
}

function formatNaira(amount) {
  const n = Number(amount) || 0;
  return `\u20a6${n.toLocaleString("en-NG")}`;
}

// Builds a short line-item summary ("2x Rice, 1x Beans") plus a structured
// items array to store on the notification's metadata for later display.
function buildOrderSummary(products, productMap) {
  const items = products.map((item) => {
    const productId = item.product_id._id;
    const product = productMap.get(String(productId));
    const quantity = parseInt(item.product_quatity) || 0;
    const name = product?.product_name || "Item";
    const price = getProductPrice(product);
    return { product_id: productId, name, quantity, price, lineTotal: price * quantity };
  });

  const shortSummary = items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  return { items, shortSummary };
}

async function addOrder(io, req, res, next) {
  const { orderID, products, address, customer_id, amount_paid } = req.body;

  if (!address || !orderID || !customer_id || !products || !amount_paid) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    // Fetch each product once and reuse it for the stock check, the
    // quantity decrement below, and the order summary — the original code
    // fetched every product twice.
    const productMap = new Map();

    for (const item of products) {
      const product = await Product.findById(item.product_id._id);
      if (!product) {
        return res
          .status(404)
          .send({
            message: `Product with ID ${item.product_id._id} not found.`,
          });
      }
      if (product.out_of_stock) {
        return res.status(400).send({
          message: `${product.product_name} is out of stock and cannot be ordered.`,
        });
      }
      productMap.set(String(product._id), product);
    }

    // Generate a unique delivery code
    const deliveryCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Create order with status and delivery code
    const order = await Order.create({
      address,
      orderID,
      products,
      customer_id,
      amount_paid,
      delivery_code: deliveryCode,
      markets: [],
    });

    // Fetch and assign distributors based on address or city
    const distributors = await Distributor.find({
      $or: [
        { address: { $regex: new RegExp(address.address, "i") } },
        { city: { $regex: new RegExp(address.city, "i") } },
      ],
    });

    // Update order with market information
    order.distributors = distributors;
    await order.save();

    // Notify each matched distributor that a new order has been assigned to them
    await Promise.all(
      distributors.map((distributor) =>
        sendOrderAssignedEmail(
          distributor.email,
          distributor.first_name || distributor.business_name || "Distributor",
          orderID,
          `${address.address}, ${address.city}`,
        ),
      ),
    );

    // Decrement product quantity (reuses the docs fetched above)
    for (const item of products) {
      const productId = item.product_id._id;
      const productQuantity = parseInt(item.product_quatity);
      const product = productMap.get(String(productId));
      if (!product) {
        next(`Product with ID ${productId} not found.`);
        continue;
      }
      const newProductTotal = product.product_total - productQuantity;
      await Product.findByIdAndUpdate(
        productId,
        { product_total: newProductTotal },
        { new: true },
      );
    }

    // Delete items from the cart
    await Cart.deleteMany({ customer_id });

    const user = await Customer.findById(customer_id);
    const { items, shortSummary } = buildOrderSummary(products, productMap);
    const summaryLine = `${shortSummary} \u2022 Total ${formatNaira(amount_paid)} \u2022 Delivery code ${deliveryCode}`;

    // --- Admin/staff-facing notification (unchanged intent, now scoped) ---
    const adminNotification = await Notification.create({
      category: "order",
      orderId: orderID,
      title: "A new order has been placed",
      customer_id,
      full_name: `${user?.first_name} ${user?.last_name}`,
      message: `${user?.first_name} ${user?.last_name} placed an order!`,
    });
    io.to("admin").emit("notification", adminNotification);

    // --- Customer-facing notification: persisted (shows in their in-app
    // notification history) and scoped to only that customer's socket room.
    // Never io.emit() this kind of thing globally — that broadcasts every
    // customer's private order data to every connected client.
    const customerNotification = await Notification.create({
      category: "order_placed",
      orderId: orderID,
      title: "Order confirmed \ud83c\udf89",
      customer_id,
      message: summaryLine,
      metadata: { items, total: amount_paid, deliveryCode },
    });
    io.to(`customer_${customer_id}`).emit("notification", customerNotification);

    if (order) {
      const customerEmail = order.address.email;
      const customerFirstName = order.address.first_name;
      await sendOrderConfirmationEmail(
        customerFirstName,
        customerEmail,
        deliveryCode,
        order.orderID,
      );
    }

    // --- Push notification to customer (transactional) ---
    try {
      await sendPushNotification({
        userId: customer_id,
        title: "Order placed! \ud83c\udf89",
        body: summaryLine,
        data: { type: "order-placed", orderId: orderID, deliveryCode },
        kind: "transactional",
      });
    } catch (pushErr) {
      console.error("Failed to send order-placed push:", pushErr);
    }

    res.status(200).send({ order, distributors });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An unknown error occurred..." });
  }
}

async function getOrdersByCustomer(req, res, next) {
  const { customer_id } = req.params;
  try {
    const orders = await Order.find({ customer_id })
      .populate({ path: "products.product_id", model: "Product" })
      .sort({ createdAt: -1 });
    res.status(200).send(orders);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error retrieving orders for the customer." });
  }
}

async function getOrdersByOrderId(req, res, next) {
  const { orderID } = req.params;
  try {
    const orders = await Order.find({ orderID })
      .populate("customer_id")
      .populate("distributor_assigned")
      .populate({ path: "products.product_id", model: "Product" });

    if (orders.length === 0) {
      return res.status(404).send({ message: "Order not found." });
    }

    const order = orders[0];
    const orderAddress = order.address ?? {};
    const city = orderAddress.city ?? "";
    const addressText = orderAddress.address ?? "";

    let nearest = [];
    if (city || addressText) {
      const orClauses = [];
      if (addressText) {
        orClauses.push({ address: { $regex: new RegExp(addressText, "i") } });
      }
      if (city) {
        orClauses.push({ city: { $regex: new RegExp(city, "i") } });
      }

      nearest = await Distributor.find({ $or: orClauses });
    }

    res.status(200).send({ orders, nearest });
  } catch (error) {
    console.error("Error in getOrdersByOrderId:", error);
    res.status(500).send({ message: "Error retrieving order details." });
  }
}

// NOTE: now takes `io` (see routes/order.routes.js) so status changes can
// be pushed live to the customer's socket room, not just as a push notif.
async function updateOrderStatus(io, req, res, next) {
  const { orderID, status } = req.body;
  try {
    const order = await Order.findOneAndUpdate(
      { orderID },
      { status },
      { new: true },
    );

    if (!order) {
      return res.status(404).send({ message: "Order not found." });
    }

    // TODO: confirm these status strings match your actual Order status enum.
    const statusMessages = {
      Processing: {
        title: "Order is being processed \ud83d\udee0\ufe0f",
        body: "We've started processing your order.",
      },
      "Out for delivery": {
        title: "Your order is on the way! \ud83d\udeb4",
        body: "Your rider has picked up your order and is heading your way.",
      },
      Delivered: {
        title: "Order delivered \u2705",
        body: "Your order has arrived. Enjoy!",
      },
      Completed: {
        title: "Order completed \u2705",
        body: "Your order is complete. Thanks for shopping with us!",
      },
    };

    const message = statusMessages[status];

    if (message && order.customer_id) {
      // Persisted so it shows up in the customer's notification history,
      // not just as a push they might miss/dismiss.
      const notification = await Notification.create({
        category: "order_status",
        orderId: order.orderID,
        title: message.title,
        customer_id: order.customer_id,
        message: message.body,
        metadata: { status },
      });
      io.to(`customer_${order.customer_id}`).emit("notification", notification);

      try {
        await sendPushNotification({
          userId: order.customer_id,
          title: message.title,
          body: message.body,
          data: { type: "order-status", orderId: order.orderID, status },
          kind: "transactional",
        });
      } catch (pushErr) {
        console.error("Failed to send order-status push:", pushErr);
      }
    }

    res.status(200).send({ order });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An unknown error occurred..." });
  }
}

async function getAllOrders(req, res, next) {
  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
      if (role === 2001)
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const orders = await Order.find()
        .populate("customer_id")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Order.countDocuments();

      return res.status(200).send({
        orders,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving all orders." });
  }
}

async function signOrder(io, req, res, next) {
  const { orderID, delivery_code, product_image } = req.body;

  if (!orderID || !delivery_code) {
    return res
      .status(400)
      .send({ message: "Order ID and delivery code are required." });
  }

  try {
    const order = await Order.findOne({ orderID });

    if (!order) {
      return res.status(404).send({ message: "Order not found." });
    }

    if (order.delivery_code !== delivery_code) {
      return res.status(401).send({ message: "Invalid delivery code." });
    }

    order.status = "Delivered";
    if (product_image) {
      order.product_image = product_image;
    }
    await order.save();

    // FIX: this notification used to be created with no customer_id at
    // all, so it could never be found again for that customer.
    const notification = await Notification.create({
      category: "order_status",
      orderId: orderID,
      title: "Order delivered \u2705",
      customer_id: order.customer_id,
      message: "Your order has been successfully signed and delivered.",
    });

    // FIX: was io.emit(...) of the entire notifications collection to
    // every connected socket. Scope it to this one customer instead.
    io.to(`customer_${order.customer_id}`).emit("notification", notification);

    try {
      if (order.customer_id) {
        await sendPushNotification({
          userId: order.customer_id,
          title: "Order delivered \u2705",
          body: "Your order has arrived. Enjoy!",
          data: { type: "order-status", orderId: orderID, status: "Delivered" },
          kind: "transactional",
        });
      }
    } catch (pushErr) {
      console.error("Failed to send order-delivered push:", pushErr);
    }

    res.status(200).send({ message: "Order signed successfully.", order });
  } catch (error) {
    console.error("Error signing order:", error);
    res.status(500).send({ message: "An unknown error occurred." });
  }
}

module.exports = {
  addOrder,
  getAllOrders,
  updateOrderStatus,
  getOrdersByOrderId,
  getOrdersByCustomer,
  signOrder,
};