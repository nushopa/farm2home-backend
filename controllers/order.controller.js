const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const Customer = require("../models/Customer");
const Distributor = require("../models/Distributor");
const { authMiddleware } = require("../middleware/authMiddleware");
const crypto = require("crypto");
const { sendOrderConfirmationEmail } = require("../lib/sendOrderEmail");

async function addOrder(io, req, res, next) {
  const { orderID, products, address, customer_id, amount_paid } = req.body;

  if (!address || !orderID || !customer_id || !products || !amount_paid) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    // Reject the whole order up front if anything in the cart went
    // out of stock between add-to-cart and checkout.
    for (const item of products) {
      const product = await Product.findById(item.product_id._id);
      if (!product) {
        return res
          .status(404)
          .send({ message: `Product with ID ${item.product_id._id} not found.` });
      }
      if (product.out_of_stock) {
        return res.status(400).send({
          message: `${product.product_name} is out of stock and cannot be ordered.`,
        });
      }
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

    // Decrement product quantity
    for (const item of products) {
      const productId = item.product_id._id;
      const productQuantity = parseInt(item.product_quatity);

      const product = await Product.findById(productId);
      if (!product) {
        next(`Product with ID ${productId} not found.`);
        continue;
      }

      const newProductTotal = product.product_total - productQuantity;
      await Product.findByIdAndUpdate(
        productId,
        { product_total: newProductTotal },
        { new: true }
      );
    }

    // Create a notification for the user
    const user = await Customer.findById(customer_id);
    // Delete items from the cart
    await Cart.deleteMany({ customer_id });

    await Notification.create({
      category: "order",
      orderId: orderID,
      title: "A new order has been placed",
      customer_id,
      full_name: `${user?.first_name} ${user?.last_name}`,
      message: `${user?.first_name} ${user?.last_name} placed an order!`,
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);
    if (order) {
      const customerEmail = order.address.email;
      const customerFirstName = order.address.first_name;
      sendOrderConfirmationEmail(
        customerFirstName,
        customerEmail,
        deliveryCode,
        order.orderID
      );
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
    const orders = await Order.find({ customer_id });
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
      .populate("products.product_id");

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

async function updateOrderStatus(req, res, next) {
  const { orderID, status } = req.body;
  try {
    const order = await Order.findOneAndUpdate(
      { orderID },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).send({ message: "Order not found." });
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
    await Notification.create({
      category: "order",
      orderId: orderID,
      title: "Order Delivered!",
      message:
        "this order has been successfully signed and delivered to customer",
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);

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