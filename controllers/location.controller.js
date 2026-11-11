const Order = require("../models/Order");
const { notifyOrderStatus } = require("./order.controller");

async function updatePickupLocation(io, req, res, next) {
  const { orderID, pickup_location } = req.body;

  if (!orderID || !pickup_location) {
    return res
      .status(422)
      .json({ message: "orderID and pickup_location are required." });
  }

  try {
    const order = await Order.findOneAndUpdate(
      { orderID },
      { pickup_location },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    order.status = "ready for pickup";
    await order.save();
    try {
      await notifyOrderStatus(io, order, order.status, {
        title: "Order ready for pickup!",
        body: `${orderID} is ready for pickup.`,
      });
    } catch (notifyErr) {
      console.error("Failed to notify pickup-location recipients:", notifyErr);
    }

    res
      .status(200)
      .json({ message: "Pickup location updated successfully.", order });
  } catch (error) {
    console.error("Error updating pickup location:", error);
    res.status(500).json({
      message: "An unknown error occurred while updating the pickup location.",
    });
  }
}

// Controller to update pickup duration, distance, and status
async function updatePickupDetails(io, req, res, next) {
  console.log(req.body);

  const { orderID, pickup_duration, pickup_distance } = req.body;
  try {
    const order = await Order.findOneAndUpdate(
      { orderID },
      {
        pickup_duration,
        pickup_distance,
        status: "pickup ongoing", // Update the status
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    try {
      await notifyOrderStatus(io, order, order.status, {
        title: "Pickup ongoing",
        body: `The rider is traveling to the pickup location for order ${orderID}.`,
      });
    } catch (notifyErr) {
      console.error("Failed to notify pickup-detail recipients:", notifyErr);
    }

    res
      .status(200)
      .json({ message: "Pickup details updated successfully.", order });
  } catch (error) {
    console.error("Error updating pickup details:", error);
    res.status(500).json({
      message: "An unknown error occurred while updating pickup details.",
    });
  }
}

// Controller to update delivery duration, distance, and status
async function updateDeliveryDetails(io, req, res, next) {
  const { orderID, delivery_duration, delivery_distance } = req.body;

  try {
    // Find the order and update the relevant fields
    const order = await Order.findOneAndUpdate(
      { orderID },
      {
        delivery_duration,
        delivery_distance,
        status: "Shipped", // Update the status
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    try {
      await notifyOrderStatus(io, order, order.status, {
        title: "Order shipped",
        body: `The rider is traveling to the delivery location for order ${orderID}.`,
      });
    } catch (notifyErr) {
      console.error("Failed to notify delivery-detail recipients:", notifyErr);
    }

    res
      .status(200)
      .json({ message: "Delivery details updated successfully.", order });
  } catch (error) {
    console.error("Error updating delivery details:", error);
    res.status(500).json({
      message: "An unknown error occurred while updating delivery details.",
    });
  }
}

module.exports = {
  updatePickupDetails,
  updateDeliveryDetails,
  updatePickupLocation,
};
