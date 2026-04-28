const Notification = require("../models/Notification");
const Customer = require("../models/Customer")

const MARKET_REP_ROLE = 6000;


const verifyMarketRep = async (distributorId) => {
  const customer = await Customer.findById(distributorId);
  if (!customer || customer.role !== MARKET_REP_ROLE) return null;
  return customer;
}

// General notifications — emits to ALL connected clients (unchanged behaviour)
const getAllNotifications = async (io, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    io.emit("notification", notifications);
    if (res) return res.status(200).send(notifications);
  } catch (error) {
    console.error("Error emitting notifications:", error);
    throw error;
  }

};



// Emit targeted notification to a specific market rep's room only
const emitMarketRepNotification = (io, distributorId, notification) => {
  io.to(`marketrep_${distributorId}`).emit("marketrep_notification", notification);
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

const markNotificationRead = async (req, res) => {
  const {id} = req.params;
  try {
    const notification = await Notification.findByIdAndUpdate(
      id,
      {isRead: true},
      {new: true}
    )

    if (!noitification) {
      return res.status(404).json({
        success: true,
        message: "Notification not found"
      })
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    })
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "An error occured while updating the notification"
    })
  }
}

const deleteNotification = async (req, res) => {
  const {id} = req.params;
  try {
    const notification = await Notification.findByIdAndDelete(id);

    if(!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted succefully"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "An error occured while deleting the notification",
    })
  }
}

module.exports = {
  getAllNotifications,
  getMarketRepNotifications,
  markNotificationRead,
  deleteNotification,
  emitMarketRepNotification,
  verifyMarketRep
}