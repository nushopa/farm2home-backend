process.env.NODE_ENV = "production";
process.env.SKIP_SMTP_INITIALIZATION = "true";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.BACKEND_URL = "http://localhost:3000";

const request = require("supertest");
const { app } = require("../server");

test("production API responds from its health endpoint", async () => {
  const response = await request(app).get("/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    status: "ok",
    timestamp: expect.any(String),
  });
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
});
