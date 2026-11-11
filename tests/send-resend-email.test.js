const mockResendSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

const { Resend } = require("resend");
const { sendResendEmail } = require("../lib/util/sendResendEmail");

describe("sendResendEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "Nushopa <info@nushopa.com>";
    mockResendSend.mockReset().mockResolvedValue({
      data: { id: "email-1" },
      error: null,
    });
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = originalFrom;
  });

  test("sends through Resend using the configured sender", async () => {
    await expect(
      sendResendEmail({
        to: "customer@example.com",
        subject: "Order update",
        text: "Your order is on its way.",
      }),
    ).resolves.toEqual({ id: "email-1" });

    expect(Resend).toHaveBeenCalledWith("re_test_key");
    expect(mockResendSend).toHaveBeenCalledWith({
      from: "Nushopa <info@nushopa.com>",
      to: "customer@example.com",
      subject: "Order update",
      text: "Your order is on its way.",
    });
  });

  test("reports missing Resend credentials and sender configuration", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendResendEmail({
        to: "customer@example.com",
        subject: "Order update",
        text: "Update",
      }),
    ).rejects.toThrow("RESEND_API_KEY is required");

    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM;
    await expect(
      sendResendEmail({
        to: "customer@example.com",
        subject: "Order update",
        text: "Update",
      }),
    ).rejects.toThrow("RESEND_FROM is required");
  });

  test("surfaces Resend API errors", async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid API key" },
    });

    await expect(
      sendResendEmail({
        to: "customer@example.com",
        subject: "Order update",
        text: "Update",
      }),
    ).rejects.toThrow("Resend failed to send email: Invalid API key");
  });
});
