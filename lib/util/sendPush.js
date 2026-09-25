const Device = require("../../models/Device");
const admin = require("../firebaseAdmin");

let expoClientPromise = null;
async function getExpoClient() {
  if (!expoClientPromise) {
    expoClientPromise = import("expo-server-sdk").then(({ Expo }) => new Expo());
  }
  return expoClientPromise;
}

/**
 * FCM data payloads must be flat string key/value pairs.
 */
function stringifyData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? "")])
  );
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

  // Split by which token type the device actually has, not by its
  // declared `platform`, so nothing breaks if that field is ever missing.
  const expoDevices = devices.filter((d) => d.expoPushToken);
  const webDevices = devices.filter((d) => d.webPushToken);

  const [expoResults, webResults] = await Promise.all([
    sendExpoPush(expoDevices, { title, body, data }),
    sendWebPush(webDevices, { title, body, data }),
  ]);

  return [...expoResults, ...webResults];
};

async function sendExpoPush(devices, { title, body, data }) {
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
      console.error("sendPushNotification: error sending Expo chunk:", JSON.stringify(error));
    }
  }

  await handleExpoTickets(tickets, messages);

  return tickets;
}

async function handleExpoTickets(tickets, messages) {
  const staleTokens = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === "error") {
      console.error(
        `sendPushNotification: Expo ticket error for token ${messages[index]?.to}:`,
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
      console.error("sendPushNotification: failed to clean up stale Expo tokens:", error);
    }
  }
}


async function sendWebPush(devices, { title, body, data }) {
  if (devices.length === 0) return [];

  const tokens = devices.map((d) => d.webPushToken);

  const message = {
    notification: { title, body },
    data: stringifyData(data),
    tokens,
    webpush: {
      notification: { icon: "/icon.png" }, // adjust to your actual site icon
    },
  };

  let response;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
  } catch (error) {
    console.error("sendPushNotification: error sending web push batch:", error);
    return [];
  }

  const results = response.responses.map((r, i) => ({
    status: r.success ? "ok" : "error",
    token: tokens[i],
    message: r.error?.message,
    details: r.error ? { error: r.error.code } : undefined,
  }));

  await handleWebPushResults(results);

  return results;
}

async function handleWebPushResults(results) {
  const staleTokens = results
    .filter(
      (r) =>
        r.status === "error" &&
        (r.details?.error === "messaging/registration-token-not-registered" ||
          r.details?.error === "messaging/invalid-registration-token")
    )
    .map((r) => r.token);

  if (staleTokens.length > 0) {
    try {
      await Device.deleteMany({ webPushToken: { $in: staleTokens } });
    } catch (error) {
      console.error("sendPushNotification: failed to clean up stale web tokens:", error);
    }
  }
}

module.exports = { sendPushNotification };