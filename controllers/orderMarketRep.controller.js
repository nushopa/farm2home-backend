const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { sendEmail } = require("../lib/util/sendEmail");
const Chat = require("../models/Chat");

async function assignDistributor(req, res) {
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

    order.distributor_assigned = null;
    await order.save();

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

async function confirmDeliveryCode(req, res) {
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

module.exports = {
  assignDistributor,
  unassignDistributor,
  getAssignedDistributor,
  getOrdersByDistributor,
  confirmDeliveryCode,
};