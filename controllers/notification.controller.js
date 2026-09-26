const Notification = require("../models/Notification");
const Customer = require("../models/Customer");
const { sendPushNotification } = require("../lib/util/sendPush");

const MARKET_REP_ROLE = 6000;

const verifyMarketRep = async (distributorId) => {
  const customer = await Customer.findById(distributorId);
  if (!customer || customer.role !== MARKET_REP_ROLE) return null;
  return customer;
};

const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    return res.status(200).send(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).send({ message: "Error fetching notifications" });
  }
};


const getCustomerNotifications = async (req, res) => {
  const { customerId } = req.params;
  if (!customerId) {
    return res.status(400).json({ success: false, message: "Customer ID is required" });
  }
  try {
    const notifications = await Notification.find({
      $or: [
        { customer_id: customerId },
        { customer_id: null, category: { $in: ["marketing", "new_product"] } },
      ],
    }).sort({ createdAt: -1 });
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching customer notifications:", error);
    return res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
};

// Fetch persisted notifications for a specific market rep
const getMarketRepNotifications = async (req, res) => {
  try {
    const { distributorId } = req.params;
    if (!distributorId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID is required",
      });
    }
    const notifications = await Notification.find({
      customer_id: distributorId,
      category: { $in: ["order_assigned", "driver_nearby", "commission_added"] },
    }).sort({ createdAt: -1 });
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching market rep notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

// Notify a specific market rep: emits to their socket room AND sends a
// push to their registered devices (transactional — order-specific, not
// marketing, so it always goes out regardless of marketing_push_enabled).
// Requires the distributor's client to have emitted "join_marketrep_room"
// (see server.js) so their socket actually joined this room.
const emitMarketRepNotification = async (io, distributorId, notification) => {
  io.to(`marketrep_${distributorId}`).emit("marketrep_notification", notification);

  try {
    await sendPushNotification({
      userId: distributorId,
      title: notification?.title || "New update",
      body: notification?.message || "",
      data: {
        type: notification?.category || "marketrep",
        orderId: notification?.orderId || "",
      },
      kind: "transactional",
    });
  } catch (pushErr) {
    console.error("Failed to send market rep push:", pushErr);
  }
};

// Same pattern for a single customer — use this from any controller that
// needs to notify one shopper, instead of a global io.emit.
const emitCustomerNotification = (io, customerId, notification) => {
  io.to(`customer_${customerId}`).emit("notification", notification);
};

// For notifications with no single owner (marketing, new_product) — a
// global broadcast is fine here since there's no private data in them.
const emitBroadcastNotification = (io, notification) => {
  io.emit("notification", notification);
};

const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true },
    );

    if (!notification) {
      // FIX: was `success: true` on a 404 — inconsistent with every other
      // not-found response in this file.
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "An error occured while updating the notification",
    });
  }
};

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted succefully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "An error occured while deleting the notification",
    });
  }
};

module.exports = {
  getAllNotifications,
  getCustomerNotifications,
  getMarketRepNotifications,
  markNotificationRead,
  deleteNotification,
  emitMarketRepNotification,
  emitCustomerNotification,
  emitBroadcastNotification,
  verifyMarketRep,
};