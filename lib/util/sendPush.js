const Device = require("../../models/Device");

let expoClientPromise = null;
async function getExpoClient() {
  if (!expoClientPromise) {
    expoClientPromise = import("expo-server-sdk").then(({ Expo }) => new Expo());
  }
  return expoClientPromise;
}

const sendPushNotification = async ({
  userId = null,
  userIds = null,
  deviceIds = null,
  title,
  body,
  data = {},
  kind = "transactional",
}) => {
  if (!title || !body) {
    throw new Error("sendPushNotification: title and body are required");
  }

  const query = { pushEnabled: true };

  if (kind === "marketing") {
    query.marketingPushEnabled = true;
  }

  if (userId) {
    query.userId = userId;
  } else if (userIds && userIds.length > 0) {
    query.userId = { $in: userIds };
  } else if (deviceIds && deviceIds.length > 0) {
    query.deviceId = { $in: deviceIds };
  }

  let devices = [];
  try {
    devices = await Device.find(query);
  } catch (error) {
    console.error("sendPushNotification: failed to fetch devices:", error);
    return [];
  }

  if (devices.length === 0) return [];

  const expo = await getExpoClient();

  const messages = devices
    .filter((device) => expo.constructor.isExpoPushToken(device.expoPushToken))
    .map((device) => ({
      to: device.expoPushToken,
      sound: "default",
      title,
      body,
      data,
    }));

  if (messages.length === 0) return [];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("sendPushNotification: error sending chunk:", JSON.stringify(error));
    }
  }

  await handlePushTickets(tickets, messages, expo);

  return tickets;
};

async function handlePushTickets(tickets, messages, expo) {
  const staleTokens = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === "error") {
      console.error(
        `sendPushNotification: ticket error for token ${messages[index]?.to}:`,
        ticket.message,
        ticket.details
      );

      if (ticket.details?.error === "DeviceNotRegistered") {
        staleTokens.push(messages[index].to);
      }
    }
  });

  if (staleTokens.length > 0) {
    try {
      await Device.deleteMany({ expoPushToken: { $in: staleTokens } });
    } catch (error) {
      console.error("sendPushNotification: failed to clean up stale tokens:", error);
    }
  }
}

module.exports = { sendPushNotification };