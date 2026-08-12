const { sendPushNotification } = require("../lib/util/sendPush");
const { authMiddleware } = require("../middleware/authMiddleware");

module.exports.sendMarketingPush = async (req, res, next) => {
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
        kind: "marketing",
      });

      return res.status(200).send({ success: true, sent: tickets.length });
    });
  } catch (error) {
    next(error);
  }
};