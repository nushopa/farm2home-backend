const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Distributor = require("../models/Distributor");
const { authMiddleware } = require("../middleware/authMiddleware");
const crypto = require("crypto");
const { sendOrderAssignedEmail } = require("../lib/sendAssignmentEmail");
const { notifyAdminAction, notifyUser } = require("../lib/util/deliverNotification");
const { notifyOrderPlaced } = require("../lib/util/notifyOrderPlaced");
const Driver = require("../models/Driver");

async function addOrder(io, req, res, next) {
  const { orderID, products, address, customer_id, amount_paid } = req.body;

  if (!address || !orderID || !customer_id || !products || !amount_paid) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
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

    const deliveryCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    const order = await Order.create({
      address,
      orderID,
      products,
      customer_id,
      amount_paid,
      delivery_code: deliveryCode,
      markets: [],
    });

    const distributors = await Distributor.find({
      $or: [
        { address: { $regex: new RegExp(address.address, "i") } },
        { city: { $regex: new RegExp(address.city, "i") } },
      ],
    });

    order.distributors = distributors;
    await order.save();

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

    await Cart.deleteMany({ customer_id });

    try {
      await notifyOrderPlaced(io, order);
    } catch (notifyErr) {
      console.error("Failed to notify order recipients:", notifyErr);
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

    const message = statusMessages[status] || {
      title: "Order status updated",
      body: `Order ${order.orderID} status changed to ${status}.`,
    };
    try {
      await notifyOrderStatus(io, order, status, message);
    } catch (notifyErr) {
      console.error("Failed to notify order-status recipients:", notifyErr);
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

    try {
      await notifyOrderStatus(io, order, "Delivered", {
        title: "Order delivered \u2705",
        body: "Your order has arrived. Enjoy!",
      });
    } catch (notifyErr) {
      console.error("Failed to notify delivery-status recipients:", notifyErr);
    }

    res.status(200).send({ message: "Order signed successfully.", order });
  } catch (error) {
    console.error("Error signing order:", error);
    res.status(500).send({ message: "An unknown error occurred." });
  }
}

async function notifyOrderStatus(io, order, status, message) {
  const metadata = { status };
  const orderId = order.orderID;
  const customer = await Customer.findById(order.customer_id)
    .select("_id email first_name last_name role")
    .lean();

  if (customer) {
    await notifyUser(io, {
      ...customer,
      email: customer.email || order.address?.email,
    }, {
      category: "order_status",
      orderId,
      title: message.title,
      message: message.body,
      metadata,
      channels: ["push", "email"],
    });
  }

  await notifyAdminAction(io, {
    category: "order_status",
    orderId,
    title: message.title,
    message: `Order ${orderId}: ${message.body}`,
    metadata,
    channels: ["push", "email"],
  });

  if (order.distributor_assigned) {
    const distributor = await Customer.findById(order.distributor_assigned)
      .select("_id email first_name last_name role")
      .lean();
    if (distributor) {
      await notifyUser(io, distributor, {
        category: "order_status",
        orderId,
        title: message.title,
        message: `Order ${orderId}: ${message.body}`,
        metadata,
        channels: ["push", "email"],
      });
    }
  }

  if (order.driver_assigned) {
    const driver = await Driver.findById(order.driver_assigned)
      .select("_id email firstName lastName")
      .lean();
    if (driver) {
      await notifyUser(io, driver, {
        userModel: "Drivers",
        category: "order_status",
        orderId,
        title: message.title,
        message: `Order ${orderId}: ${message.body}`,
        metadata,
        channels: ["push", "email"],
      });
    }
  }
}

module.exports = {
  addOrder,
  getAllOrders,
  updateOrderStatus,
  notifyOrderStatus,
  getOrdersByOrderId,
  getOrdersByCustomer,
  signOrder,
};