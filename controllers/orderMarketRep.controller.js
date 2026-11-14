const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { sendEmail } = require("../lib/util/sendEmail");
const Chat = require("../models/Chat");
const { sendPushNotification } = require("../lib/util/sendPush");
const {
  notifyAdminAction,
  notifyUser,
  sendNotificationEmail,
} = require("../lib/util/deliverNotification");
const { notifyOrderStatus } = require("./order.controller");
const { sendDetailedOrderAssignedEmail } = require("../lib/sendAssignmentEmail");
const { authMiddleware } = require("../middleware/authMiddleware");

const MARKET_REP_STATUSES = {
  Processing: {
    title: "Order is being processed",
    body: "We've started processing your order.",
  },
  "ready for pickup": {
    title: "Order ready for pickup",
    body: "Your order is packed and ready for pickup by the rider.",
  },
  Shipped: {
    title: "Your order has been shipped",
    body: "Your order is on its way to you.",
  },
  Delivered: {
    title: "Order delivered",
    body: "Your order has arrived. Enjoy!",
  },
};
const STATUS_FLOW = Object.keys(MARKET_REP_STATUSES);
const LOCKED_STATUSES = ["Confirmed", "Completed"];


async function assignDistributor(io, req, res) {
  const { orderID, distributorID } = req.body;

  if (!orderID || !distributorID) {
    return res
      .status(400)
      .json({ message: "OrderID and distributorID are required." });
  }

  try {
    const order = await Order.findOne({ orderID });
    if (!order) return res.status(404).json({ message: "Order not found." });

    const distributor = await Customer.findById(distributorID);
    if (!distributor || distributor.role !== 6000) {
      return res
        .status(400)
        .json({ message: "Invalid distributor. Must be a customer with role 6000." });
    }

    // If a different distributor was assigned, reset first
    if (
      order.distributor_assigned &&
      order.distributor_assigned.toString() !== distributorID
    ) {
      order.distributor_assigned = null;
      await order.save();
    }

    // If same distributor is already assigned
    if (
      order.distributor_assigned &&
      order.distributor_assigned.toString() === distributorID
    ) {
      return res
        .status(200)
        .json({ message: "Distributor already assigned.", order });
    } else {
      order.distributor_assigned = distributorID;
      await order.save();
      await order.populate("distributor_assigned");
    }

    await notifyUser(io, distributor, {
      category: "order_assigned",
      orderId: orderID,
      title: "New order assigned to you 📦",
      message: `Order ${orderID} has been assigned to you for pickup.`,
      channels: ["push"],
    });
    try {
      await sendDetailedOrderAssignedEmail(order, distributor, "market representative");
    } catch (emailError) {
      console.error("Failed to email market rep order details:", emailError);
    }
    await notifyAdminAction(io, {
      category: "order_assigned",
      orderId: orderID,
      title: "Market rep assigned to order",
      message: `Order ${orderID} was assigned to ${distributor.first_name} ${distributor.last_name}.`,
      metadata: { distributorId: String(distributorID) },
      channels: ["push", "email"],
    });

    return res
      .status(200)
      .json({ message: "Distributor assigned successfully", order });
  } catch (error) {
    console.error("Error assigning distributor:", error);
    res.status(500).json({
      message: "An unknown error occurred while assigning the distributor.",
    });
  }
}

async function unassignDistributor(req, res) {
  const { orderID } = req.body;

  if (!orderID) {
    return res.status(400).json({ message: "orderID is required." });
  }

  try {
    const order = await Order.findOne({ orderID });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.distributor_assigned) {
      return res
        .status(400)
        .json({ message: "No distributor is assigned to this order." });
    }

    const previousDistributorId = order.distributor_assigned;
    order.distributor_assigned = null;
    await order.save();

    // --- Push notification to the (former) distributor (transactional) ---
    try {
      await sendPushNotification({
        userId: previousDistributorId,
        title: "Order unassigned",
        body: `Order ${orderID} is no longer assigned to you.`,
        data: { type: "order-unassigned", orderId: orderID },
        kind: "transactional",
      });
    } catch (pushErr) {
      console.error("Failed to send distributor-unassigned push:", pushErr);
    }
    try {
      const distributor = await Customer.findById(previousDistributorId);
      if (distributor) {
        await sendNotificationEmail(distributor, {
          title: "Order unassigned",
          message: `Order ${orderID} is no longer assigned to you.`,
        });
      } else {
        console.warn(
          `Cannot email distributor-unassigned notification: ${previousDistributorId} not found.`,
        );
      }
    } catch (emailErr) {
      console.error("Failed to load distributor-unassigned email recipient:", emailErr);
    }

    res
      .status(200)
      .json({ message: "Distributor unassigned successfully", order });
  } catch (error) {
    console.error("Error unassigning distributor:", error);
    res.status(500).json({
      message: "An unknown error occurred while unassigning the distributor.",
    });
  }
}

async function getAssignedDistributor(req, res) {
  const { orderID } = req.params;

  try {
    const order = await Order.findOne({ orderID }).populate(
      "distributor_assigned"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.distributor_assigned) {
      return res
        .status(200)
        .json({ message: "No distributor assigned.", distributor: null });
    }

    res.status(200).json({ distributor: order.distributor_assigned });
  } catch (error) {
    console.error("Error retrieving assigned distributor:", error);
    res.status(500).json({
      message:
        "An unknown error occurred while fetching the assigned distributor.",
    });
  }
}

async function getOrdersByDistributor(req, res, next) {
  const { distributorID } = req.params;

  try {
    const orders = await Order.find({ distributor_assigned: distributorID })
      .populate("customer_id")
      .populate("distributor_assigned");

    if (orders.length === 0) {
      return res
        .status(204)
        .json({ message: "No orders found for this distributor." });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error retrieving orders for distributor:", error);
    res.status(500).json({
      message: "An unknown error occurred while fetching the orders.",
    });
  }
}

async function confirmDeliveryCode(io, req, res) {
  const { orderID, delivery_code } = req.body;

  if (!orderID || !delivery_code) {
    return res
      .status(400)
      .json({ message: "orderID and Delivery Code are required." });
  }

  try{
    const order = await Order.findOneAndUpdate(
      { orderID, delivery_code }, 
      { status: "Confirmed" },  
      { new: true }              
    );
    if (!order) {
      return res.
      status(404)
      .json({ message: "Order not found or invalid delivery code." });
    }

    try {
      await notifyOrderStatus(io, order, "Confirmed", {
        title: "Delivery confirmed",
        body: "The delivery code was confirmed and the order is complete.",
      });
    } catch (notifyErr) {
      console.error("Failed to notify delivery-confirmation recipients:", notifyErr);
    }

     // Return only relevant fields to avoid exposing sensitive data
    return res.status(200).json({
      message: "Delivery code confirmed. Order status updated.",
      order: {
        orderID: order.orderID,
        status: order.status
      }
    });

  }catch (error) {
    console.error("Error confirming delivery code:", error);
    res.status(500).json({
      message: "An unknown error occurred while confirming the delivery code.",
    });
  }
}

 async function updateOrderStatusByMarketRep (io, req, res) {
  authMiddleware(req, res, async () => {
    try {
      const { userId, role } = req;
      const { orderID, status } = req.body;

      if (role !== 6000) {
        return res.status(403).json({ success: false, message: "Only market representatives can do this." });
      }
      if (!orderID || !MARKET_REP_STATUSES[status]) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${STATUS_FLOW.join(", ")}`,
        });
      }

      const order = await Order.findOne({ orderID });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found." });
      }
      if (String(order.distributor_assigned) !== String(userId)) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you." });
      }
      if (LOCKED_STATUSES.includes(order.status)) {
        return res.status(400).json({ success: false, message: "This order is already complete." });
      }

      const currentIdx = STATUS_FLOW.findIndex(
        (s) => s.toLowerCase() === String(order.status || "").toLowerCase(),
      );
      if (currentIdx !== -1 && STATUS_FLOW.indexOf(status) <= currentIdx) {
        return res.status(400).json({
          success: false,
          message: `Order is already "${order.status}". Status can only move forward.`,
        });
      }

      order.status = status;
      await order.save();

      try {
        await notifyOrderStatus(io, order, status, MARKET_REP_STATUSES[status]);
      } catch (notifyErr) {
        console.error("Failed to notify order-status recipients:", notifyErr);
      }

      return res.status(200).json({
        success: true,
        message: `Order marked as ${status}`,
        data: { orderID: order.orderID, status: order.status },
      });
    } catch (error) {
      console.error("updateOrderStatusByMarketRep error:", error);
      return res.status(500).json({ success: false, message: "Could not update order status." });
    }
  });
};

module.exports = {
  assignDistributor,
  unassignDistributor,
  getAssignedDistributor,
  getOrdersByDistributor,
  confirmDeliveryCode,
  updateOrderStatusByMarketRep
};