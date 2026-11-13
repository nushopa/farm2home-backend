jest.mock("../models/Customer", () => ({
  findById: jest.fn(),
}));
jest.mock("../models/Product", () => ({
  find: jest.fn(),
}));
jest.mock("../models/Notification", () => ({
  create: jest.fn(),
}));
jest.mock("../lib/util/deliverNotification", () => ({
  notifyAdminAction: jest.fn(),
  escapeHtml: (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    }),
}));
jest.mock("../lib/util/sendPush", () => ({
  sendPushNotification: jest.fn(),
}));
jest.mock("../lib/sendOrderEmail", () => ({
  sendOrderConfirmationEmail: jest.fn(),
}));
jest.mock("../lib/util/sendResendEmail", () => ({
  sendResendEmail: jest.fn(),
}));

const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const { notifyAdminAction } = require("../lib/util/deliverNotification");
const { sendPushNotification } = require("../lib/util/sendPush");
const { sendOrderConfirmationEmail } = require("../lib/sendOrderEmail");
const { sendResendEmail } = require("../lib/util/sendResendEmail");
const { notifyOrderPlaced } = require("../lib/util/notifyOrderPlaced");
process.env.JWT_SECRET ||= "test-only-jwt-secret";
const { createDistributorNotification } = require("../controllers/marketRep/oauthService");
const {
  notifyAdminOnboarded,
  sendWelcomeEmail,
} = require("../lib/util/onboarding");

describe("notification helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.F_URL = "https://nushopa.com";
  });

  test("notifies admins and customers after an order with product references", async () => {
    const customer = {
      _id: "customer-1",
      email: "customer@example.com",
      first_name: "Customer",
      last_name: "One",
    };
    const notification = { _id: { toString: () => "notification-1" } };
    const room = { emit: jest.fn() };
    const io = { to: jest.fn().mockReturnValue(room) };
    const order = {
      orderID: "order-1",
      customer_id: customer._id,
      products: [{ product_id: { _id: "product-1" }, product_quatity: "2" }],
      address: { first_name: "Customer", email: customer.email },
      amount_paid: 100,
      delivery_code: "ABCD1234",
    };
    const customerQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(customer),
    };
    const productQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: "product-1", product_name: "Apples", product_price: 50 },
      ]),
    };

    Customer.findById.mockReturnValue(customerQuery);
    Product.find.mockReturnValue(productQuery);
    Notification.create.mockResolvedValue(notification);
    notifyAdminAction.mockResolvedValue();
    sendPushNotification.mockResolvedValue([]);
    sendOrderConfirmationEmail.mockResolvedValue();

    await notifyOrderPlaced(io, order);

    expect(Product.find).toHaveBeenCalledWith({
      _id: { $in: ["product-1"] },
    });
    expect(notifyAdminAction).toHaveBeenCalledWith(
      io,
      expect.objectContaining({ category: "order", orderId: order.orderID }),
    );
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "order_placed",
        metadata: expect.objectContaining({
          items: [
            expect.objectContaining({
              name: "Apples",
              quantity: 2,
              price: 50,
              lineTotal: 100,
            }),
          ],
        }),
      }),
    );
    expect(room.emit).toHaveBeenCalledWith("notification", notification);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: customer._id,
        data: expect.objectContaining({ notificationId: "notification-1" }),
      }),
    );
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customerFirstName: "Customer",
        customerEmail: customer.email,
        deliveryCode: order.delivery_code,
        orderID: order.orderID,
        amountPaid: order.amount_paid,
        items: [
          expect.objectContaining({
            name: "Apples",
            quantity: 2,
            price: 50,
            lineTotal: 100,
          }),
        ],
      }),
    );
  });

  test("sends welcome email and admin onboarding notifications", async () => {
    const user = {
      _id: "rider-1",
      email: "rider@example.com",
      firstName: "Rider",
      lastName: "One",
    };

    sendResendEmail.mockResolvedValue({ id: "email-1" });
    notifyAdminAction.mockResolvedValue();

    await sendWelcomeEmail("rider", {
      email: user.email,
      firstName: user.firstName,
    });
    await notifyAdminOnboarded(null, "rider", user);

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: expect.stringContaining("rider"),
      }),
    );
    expect(notifyAdminAction).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        category: "onboarding",
        metadata: { userId: user._id, userType: "rider" },
        channels: ["push", "email"],
      }),
    );
  });

  test.each([
    [
      "customer",
      "customer@example.com",
      "Ava",
      "Welcome to Nushopa!",
      "Nushopa connects you with fresh farm produce",
    ],
    [
      "marketrep",
      "rep@example.com",
      "Sam",
      "Welcome to the Nushopa team!",
      "Market reps help Nushopa fulfill customer orders",
    ],
  ])(
    "personalizes the %s welcome email for its recipient and role",
    async (type, email, firstName, heading, roleCopy) => {
      await sendWelcomeEmail(type, { email, firstName });

      expect(sendResendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          text: expect.stringContaining(`Hi ${firstName},`),
          html: expect.stringContaining(`Hi ${firstName},`),
        }),
      );
      expect(sendResendEmail.mock.calls[0][0].text).toContain(heading);
      expect(sendResendEmail.mock.calls[0][0].text).toContain(roleCopy);
    },
  );

  test("includes a start-shopping button in the customer welcome email", async () => {
    await sendWelcomeEmail("customer", {
      email: "customer@example.com",
      firstName: "Ava",
    });

    expect(sendResendEmail.mock.calls[0][0].text).toContain(
      "Start shopping: https://nushopa.com/",
    );
    expect(sendResendEmail.mock.calls[0][0].html).toContain(
      '<a href="https://nushopa.com/"',
    );
    expect(sendResendEmail.mock.calls[0][0].html).toContain(">Start shopping</a>");
  });

  test("explains the market rep's order-fulfillment responsibilities", async () => {
    await sendWelcomeEmail("marketrep", {
      email: "rep@example.com",
      firstName: "Sam",
    });

    const email = sendResendEmail.mock.calls[0][0];
    expect(email.text).toContain("orders assigned to you");
    expect(email.text).toContain("customer's delivery code");
    expect(email.html).toContain("orders assigned to you");
    expect(email.html).toContain("customer&#39;s delivery code");
  });

  test("escapes a recipient's name in welcome email HTML", async () => {
    await sendWelcomeEmail("marketrep", {
      email: "rep@example.com",
      firstName: "<Sam>",
    });

    expect(sendResendEmail.mock.calls[0][0].html).toContain("&lt;Sam&gt;");
    expect(sendResendEmail.mock.calls[0][0].html).not.toContain("<Sam>");
  });

  test("sends the market rep welcome email even if admin notification storage fails", async () => {
    const distributor = {
      _id: "rep-1",
      firstName: "Sam",
      lastName: "One",
      email: "rep@example.com",
    };
    const io = { emit: jest.fn() };
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});
    Notification.create.mockRejectedValue(new Error("notification storage failed"));
    sendResendEmail.mockResolvedValue({ id: "email-1" });
    notifyAdminAction.mockResolvedValue();

    await createDistributorNotification(io, distributor);

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: distributor.email,
        subject: "Welcome to the Nushopa market rep team",
      }),
    );
    expect(logError).toHaveBeenCalledWith(
      "Market rep registration notification failed:",
      expect.any(Error),
    );
    logError.mockRestore();
  });
});
