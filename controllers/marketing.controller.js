const { sendPushNotification } = require("../lib/util/sendPush");
const { authMiddleware } = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");

// NOTE: now takes `io` as the first argument (see routes/device.routes.js)
// so marketing announcements can also be persisted + broadcast in-app,
// not just sent as a push that disappears once dismissed.
module.exports.sendMarketingPush = async (io, req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
      if (role === 2001 || role === 6000) {
        return res.status(401).send({ message: "You are not authorized to access this route" });
      }

      const { title, body, data } = req.body;

      if (!title || !body) {
        return res.status(400).send({ message: "title and body are required" });
      }

      const tickets = await sendPushNotification({
        title,
        body,
        data: data || {},
        kind: "marketing", // only reaches devices with marketingPushEnabled: true
      });

      // Persisted with customer_id: null since this isn't tied to one
      // user — getCustomerNotifications picks these up for everyone.
      const notification = await Notification.create({
        category: "marketing",
        customer_id: null,
        title,
        message: body,
        metadata: data || {},
      });

      // Marketing content has no private data, so a plain broadcast is
      // fine here — unlike order notifications, which must only ever go
      // to that one customer's room (see order.controller.js).
      io.emit("notification", notification);

      return res.status(200).send({ success: true, sent: tickets.length });
    });
  } catch (error) {
    next(error);
  }
};