jest.mock("../lib/util/sendResendEmail", () => ({
  sendResendEmail: jest.fn().mockResolvedValue({ id: "email-1" }),
}));

const { sendResendEmail } = require("../lib/util/sendResendEmail");
const { sendOrderConfirmationEmail } = require("../lib/sendOrderEmail");

describe("order confirmation email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes the purchased items, paid amount, delivery details, and code", async () => {
    await sendOrderConfirmationEmail({
      customerFirstName: "Ava",
      customerEmail: "ava@example.com",
      deliveryCode: "ABCD1234",
      orderID: "order-1",
      items: [
        {
          name: "Apples",
          quantity: 2,
          price: 500,
          lineTotal: 1000,
        },
      ],
      subtotal: 1000,
      deliveryFee: 200,
      serviceFee: 150,
      amountPaid: 1350,
      deliveryMode: "standard",
      deliveryAddress: "1 Market Road, Ikeja, Lagos",
    });

    const email = sendResendEmail.mock.calls[0][0];
    expect(email.to).toBe("ava@example.com");
    expect(email.text).toContain("Amount paid: ₦1,350");
    expect(email.text).toContain("Delivery code: ABCD1234");
    expect(email.html).toContain("Apples");
    expect(email.html).toContain("1 Market Road, Ikeja, Lagos");
    expect(email.html).toContain("₦1,350");
  });
});
