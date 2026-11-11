const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

function getCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;
  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serviceAccountPath =
    configuredPath ||
    (process.env.NODE_ENV === "production"
      ? "/etc/secrets/serviceAccountKey.json"
      : path.resolve(__dirname, "../serviceAccountKey.json"));

  if (fs.existsSync(serviceAccountPath)) {
    return cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")));
  }

  if (configuredPath) {
    throw new Error(
      `Firebase Admin service-account file does not exist: ${serviceAccountPath}`,
    );
  }

  const environmentCredentials = [
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  ];

  if (environmentCredentials.some((value) => value?.trim())) {
    const missing = [
      ["FIREBASE_PROJECT_ID", FIREBASE_PROJECT_ID],
      ["FIREBASE_CLIENT_EMAIL", FIREBASE_CLIENT_EMAIL],
      ["FIREBASE_PRIVATE_KEY", FIREBASE_PRIVATE_KEY],
    ]
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `Firebase Admin configuration is incomplete; missing ${missing.join(", ")}.`,
      );
    }

    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  throw new Error(
    `Firebase Admin is not configured. Provide a service-account file at ${serviceAccountPath}, ` +
      "set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS, or set " +
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
  );
}

if (!getApps().length) {
  initializeApp({ credential: getCredential() });
}

module.exports = { admin, messaging: getMessaging() };