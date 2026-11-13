jest.mock("../lib/firebaseAdmin", () => {
  const messaging = {
    send: jest.fn().mockResolvedValue("mock-message-id"),
    sendEachForMulticast: jest
      .fn()
      .mockResolvedValue({ successCount: 0, failureCount: 0, responses: [] }),
    sendEach: jest
      .fn()
      .mockResolvedValue({ successCount: 0, failureCount: 0, responses: [] }),
  };

  return {
    admin: { messaging: () => messaging },
    messaging,
  };
});

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.BACKEND_URL = "http://localhost:3000";
process.env.JWT_SECRET = "test-jwt-secret";

const request = require("supertest");
const { app } = require("../server");

describe("API base routes", () => {
  test("health endpoint returns a successful response and timestamp", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  test("unknown routes return the API not-found response", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.text).toBe("Page not found!");
  });
});
