const Order = require("../models/Order");
const Driver = require("../models/Driver");

async function assignDriver(req, res) {
  const { orderID, driverID } = req.body;
  try {
    // Find the order by orderID
    const order = await Order.findOne({ orderID });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Check if a driver is already assigned
    if (order.driver_assigned) {
      return res.status(400).json({
        message:
          "A driver is already assigned. Unassign first before reassigning.",
      });
    }

    // Find the driver by driverID
    const driver = await Driver.findById(driverID);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found." });
    }

    // Assign the driver to the order
    order.driver_assigned = driverID;
    order.status = "driver assigned";
    await order.save();

    await order.populate("driver_assigned"); // Populate the driver details

    res.status(200).json({
      message: "Driver assigned successfully",
      order,
    });
  } catch (error) {
    console.error("Error assigning driver:", error);
    res.status(500).json({
      message: "An unknown error occurred while assigning the driver.",
    });
  }
}
async function unassignDriver(req, res) {
  const { orderID } = req.body;

  try {
    // Find the order by orderID
    const order = await Order.findOne({ orderID });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.driver_assigned) {
      return res
        .status(400)
        .json({ message: "No driver is assigned to this order." });
    }

    // Unassign the distributor
    order.driver_assigned = null;
    await order.save();

    res.status(200).json({ message: "Driver unassigned successfully", order });
  } catch (error) {
    console.error("Error unassigning driver:", error);
    res.status(500).json({
      message: "An unknown error occurred while unassigning the driver.",
    });
  }
}

async function getAssignedDriver(req, res) {
  const { orderID } = req.params;

  try {
    // Find the order by orderID
    const order = await Order.findOne({ orderID }).populate("driver_assigned");

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.driver_assigned) {
      return res
        .status(200)
        .json({ message: "No driver assigned.", driver: null });
    }

    res.status(200).json({ driver: order.driver_assigned });
  } catch (error) {
    console.error("Error retrieving assigned driver:", error);
    res.status(500).json({
      message: "An unknown error occurred while fetching the assigned driver.",
    });
  }
}

async function getOrdersByDriver(req, res, next) {
  const { driverID } = req.params;

  try {
    // Find orders where the distributor_assigned matches the given distributorID
    const orders = await Order.find({ driver_assigned: driverID })
      .populate("customer_id")
      .populate("driver_assigned");

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

module.exports = {
  assignDriver,
  getOrdersByDriver,
  getAssignedDriver,
  unassignDriver,
};
