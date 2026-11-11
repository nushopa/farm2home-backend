const Customer = require("../../models/Customer");
const Notification = require("../../models/Notification");
const { sendResendEmail } = require("./sendResendEmail");
const { sendPushNotification } = require("./sendPush");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

async function notifyUser(
  io,
  user,
  {
    userModel = "Customer",
    category,
    title,
    message,
    orderId,
    metadata = {},
    channels = ["push"],
    kind = "transactional",
  },
) {
  if (!user?._id) {
    throw new Error("notifyUser requires a persisted user");
  }

  let notification;
  try {
    notification = await Notification.create({
      customer_id: userModel === "Customer" ? user._id : null,
      recipient_id: user._id,
      recipient_model: userModel,
      recipient_role: user.role ?? null,
      category,
      orderId,
      full_name:
        [user.first_name ?? user.firstName, user.last_name ?? user.lastName]
          .filter(Boolean)
          .join(" ") || undefined,
      title,
      message,
      metadata,
    });
  } catch (error) {
    console.error("Failed to persist notification:", error);
  }

  if (notification && io) {
    const room =
      userModel === "Drivers"
        ? `driver_${user._id}`
        : userModel === "Distributor"
          ? `marketrep_${user._id}`
          : user.role === 5000
            ? "admin"
            : `customer_${user._id}`;
    io.to(room).emit(
      userModel === "Distributor" ? "marketrep_notification" : "notification",
      notification,
    );
  }

  if (channels.includes("push")) {
    try {
      await sendPushNotification({
        userId: user._id,
        userModel,
        title,
        body: message,
        data: {
          type: category || "update",
          ...(orderId ? { orderId } : {}),
          ...metadata,
          ...(notification?._id
            ? { notificationId: notification._id.toString() }
            : {}),
        },
        kind,
      });
    } catch (error) {
      console.error("Failed to send notification push:", error);
    }
  }

  if (channels.includes("email") && user.email) {
    try {
      const emailMessage = String(message ?? "");
      await sendResendEmail({
        to: user.email,
        subject: title,
        text: emailMessage,
        html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(emailMessage)}</p>`,
      });
    } catch (error) {
      console.error(`Failed to email notification to ${user.email}:`, error);
    }
  } else if (channels.includes("email")) {
    console.warn(
      `Cannot email notification "${title}": recipient has no email address.`,
    );
  }

  return notification;
}

async function notifyRole(io, role, payload) {
  try {
    const users = await Customer.find({ role })
      .select("_id email first_name last_name role")
      .lean();
    await Promise.all(users.map((user) => notifyUser(io, user, payload)));
  } catch (error) {
    console.error(`Failed to load recipients for role ${role}:`, error);
  }
}

async function notifyCustomerAudience(io, payload) {
  let notification;
  try {
    notification = await Notification.create({
      category: payload.category,
      customer_id: null,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata || {},
    });
  } catch (error) {
    console.error("Failed to persist customer-audience notification:", error);
  }
  if (notification && io) io.emit("notification", notification);

  try {
    const customerIds = await Customer.find({ role: 2001 }).distinct("_id");
    await sendPushNotification({
      userIds: customerIds,
      userModel: "Customer",
      title: payload.title,
      body: payload.message,
      data: {
        type: payload.category || "update",
        ...(payload.metadata || {}),
      },
      kind: payload.kind || "marketing",
    });
  } catch (error) {
    console.error("Failed to send customer-audience push:", error);
  }

  return notification;
}

async function notifyAdminAction(io, payload) {
  await notifyRole(io, 5000, payload);
}

module.exports = {
  notifyUser,
  notifyRole,
  notifyCustomerAudience,
  notifyAdminAction,
};
