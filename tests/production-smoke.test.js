const { generateKeyPairSync } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.NODE_ENV = "production";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.BACKEND_URL = "http://localhost:3000";
process.env.JWT_SECRET = "test-jwt-secret";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const serviceAccountPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "farm2home-firebase-test-")),
  "serviceAccountKey.json",
);
fs.writeFileSync(
  serviceAccountPath,
  JSON.stringify({
    type: "service_account",
    project_id: "production-smoke-test",
    private_key_id: "test-key-id",
    private_key: privateKey,
    client_email:
      "firebase-adminsdk-test@production-smoke-test.iam.gserviceaccount.com",
    client_id: "123456789",
    token_uri: "https://oauth2.googleapis.com/token",
  }),
);
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = serviceAccountPath;
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;

const request = require("supertest");
let messaging;
try {
  ({ messaging } = require("../lib/firebaseAdmin"));
} finally {
  fs.rmSync(path.dirname(serviceAccountPath), { recursive: true, force: true });
  delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
}
const { app } = require("../server");

test("production API responds from its health endpoint", async () => {
  expect(messaging.app.options.credential.projectId).toBe(
    "production-smoke-test",
  );

  const response = await request(app).get("/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    status: "ok",
    timestamp: expect.any(String),
  });
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
});
