jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(),
  cert: jest.fn((serviceAccount) => ({ serviceAccount })),
}));
jest.mock("firebase-admin/messaging", () => ({
  getMessaging: jest.fn(() => ({ send: jest.fn() })),
}));
jest.mock("firebase-admin", () => ({ name: "test-admin" }));
jest.mock("node:fs", () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(),
}));

describe("Firebase Admin initialization", () => {
  const firebaseEnvKeys = [
    "NODE_ENV",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];
  const originalEnv = {};

  beforeAll(() => {
    for (const key of firebaseEnvKeys) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(() => {
    jest.resetModules();
    for (const key of firebaseEnvKeys) {
      delete process.env[key];
    }
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    for (const key of firebaseEnvKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  test("initializes Firebase Admin from environment credentials", () => {
    process.env.FIREBASE_PROJECT_ID = "nushopa-test";
    process.env.FIREBASE_CLIENT_EMAIL = "firebase-test@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "test-key\\nline-two";

    const firebaseApp = require("firebase-admin/app");
    firebaseApp.getApps.mockReturnValue([]);
    const { getMessaging } = require("firebase-admin/messaging");
    const { admin, messaging } = require("../lib/firebaseAdmin");

    expect(firebaseApp.cert).toHaveBeenCalledWith({
      projectId: "nushopa-test",
      clientEmail: "firebase-test@example.com",
      privateKey: "test-key\nline-two",
    });
    expect(firebaseApp.initializeApp).toHaveBeenCalledWith({
      credential: {
        serviceAccount: {
          projectId: "nushopa-test",
          clientEmail: "firebase-test@example.com",
          privateKey: "test-key\nline-two",
        },
      },
    });
    expect(getMessaging).toHaveBeenCalledTimes(1);
    expect(messaging).toBe(getMessaging.mock.results[0].value);
    expect(admin).toEqual({ name: "test-admin" });
  });
});
