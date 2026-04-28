const mongoose = require("mongoose");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const {
  emitMarketRepNotification,
  verifyMarketRep,           
} = require("./notification.controller");

const COMMISSION_RATE = 0.10;

// Centralized notification type constants — avoids typo bugs
const NOTIFICATION_TYPES = {
  ORDER_ASSIGNED: "order_assigned",
  DRIVER_NEARBY: "driver_nearby",
  COMMISSION_EARNED: "commission_earned",
};


const createMarketRepNotification = async (
  io,
  distributorId,
  category,
  title,
  message,
  metadata = {}
) => {
  const notification = await Notification.create({
    customer_id: distributorId, // market rep's ID stored under customer_id
    category,
    title,
    message,
    metadata,
    isRead: false,              // ensure field is explicitly initialized
  });

  emitMarketRepNotification(io, distributorId, notification);
  return notification;
};


const getTotalAssignedOrders = async (req, res) => {
  try {
    const { distributorId } = req.params;

    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }

    const distributor = await verifyMarketRep(distributorId);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: User is not a market representative",
      });
    }

    const totalAssignedOrders = await Order.countDocuments({
      distributor_assigned: distributorId,
    });

    return res.status(200).json({
      success: true,
      message: "Total assigned orders calculated successfully",
      data: { totalAssignedOrders },
    });
  } catch (error) {
    console.error("Error fetching total assigned orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching assigned orders",
    });
  }
};


const getConfirmedOrders = async (req, res) => {
  try {
    const { distributorId } = req.params;

    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }

    const distributor = await verifyMarketRep(distributorId);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: User is not a market representative",
      });
    }

    const totalConfirmedOrders = await Order.countDocuments({
      distributor_assigned: distributorId,
      status: "Confirmed",
    });

    return res.status(200).json({
      success: true,
      message: "Total confirmed orders calculated successfully",
      data: { totalConfirmedOrders },
    });
  } catch (error) {
    console.error("Error fetching total confirmed orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching confirmed orders",
    });
  }
};


const getPendingOrders = async (req, res) => {
  try {
    const { distributorId } = req.params;

    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }

    const distributor = await verifyMarketRep(distributorId);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: User is not a market representative",
      });
    }

    const totalPendingOrders = await Order.countDocuments({
      distributor_assigned: distributorId,
      status: "Processing",
    });

    return res.status(200).json({
      success: true,
      message: "Total pending orders calculated successfully",
      data: { totalPendingOrders },
    });
  } catch (error) {
    console.error("Error fetching total pending orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching pending orders",
    });
  }
};


const getTotalCommission = async (req, res) => {
  try {
    const { distributorId } = req.params;

    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }

    const distributor = await verifyMarketRep(distributorId);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: User is not a market representative",
      });
    }

    const distributorObjectId = new mongoose.Types.ObjectId(distributorId);

    const result = await Order.aggregate([
      {
        $match: {
          distributor_assigned: distributorObjectId,
          // Normalizes case variations: "confirmed", "Confirmed", "Completed", "Delivered"
          status: { $in: ["Confirmed", "confirmed", "Completed", "Delivered"] },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$amount_paid" },
        },
      },
    ]);

    const totalSales = result.length > 0 ? result[0].totalSales : 0;
    const totalCommission = totalSales * COMMISSION_RATE;

    return res.status(200).json({
      success: true,
      message: "Total commission calculated successfully",
      data: { totalCommission },
    });
  } catch (error) {
    console.error("Error fetching total commission:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching commission",
    });
  }
};

const getAssignedOrders = async (req, res) => {
  try {
    const { distributorId } = req.params;

    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }

    const distributor = await verifyMarketRep(distributorId);
    if (!distributor) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: User is not a market representative",
      });
    }

    const assignedOrders = await Order.find({
      distributor_assigned: distributorId,
    })
      .populate("customer_id")
      .populate("distributor_assigned")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Assigned orders fetched successfully",
      data: { assignedOrders },
    });
  } catch (error) {
    console.error("Error fetching assigned orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching assigned orders",
    });
  }
};


const notifyOrderAssigned = async (io, order) => {
  await createMarketRepNotification(
    io,
    order.distributor_assigned,
    NOTIFICATION_TYPES.ORDER_ASSIGNED,
    "Order Assigned",
    `You have been assigned a new order (ID: ${order._id}).`,
    { orderId: order._id }
  );
};


const notifyDriverNearby = async (io, distributorId, driverId) => {
  await createMarketRepNotification(
    io,
    distributorId,
    NOTIFICATION_TYPES.DRIVER_NEARBY,
    "Driver Nearby",
    `A driver (ID: ${driverId}) is nearby your location.`,
    { driverId }
  );
};


const notifyCommissionEarned = async (io, distributorId, amount) => {
  await createMarketRepNotification(
    io,
    distributorId,
    NOTIFICATION_TYPES.COMMISSION_EARNED,
    "Commission Earned",
    `You have earned a new commission of $${amount.toFixed(2)}.`,
    { amount }
  );
};


module.exports = {
  getTotalAssignedOrders,
  getConfirmedOrders,
  getPendingOrders,
  getTotalCommission,
  getAssignedOrders,
  notifyOrderAssigned,
  notifyDriverNearby,
  notifyCommissionEarned,
};