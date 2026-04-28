const { Router } = require("express");
const { 
  getAllNotifications,
  getMarketRepNotifications,
  markNotificationRead,
  deleteNotification,
} = require("../controllers/notification.controller");

const NotificationRouter = (io) => {
  const router = Router();
  router.get("/", (req, res) => getAllNotifications(io, res));
  router.get("/marketrep/:distributorId", getMarketRepNotifications);
  router.patch("/:id/read", markNotificationRead);
  router.delete("/:id", deleteNotification);
  return router;
};

module.exports = NotificationRouter;
