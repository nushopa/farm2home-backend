jest.mock("../lib/util/sendPush", () => ({
  sendPushNotification: jest.fn(),
}));
jest.mock("../lib/util/sendResendEmail", () => ({
  sendResendEmail: jest.fn(),
}));

const Customer = require("../models/Customer");
const Notification = require("../models/Notification");
const { sendResendEmail } = require("../lib/util/sendResendEmail");
const { sendPushNotification } = require("../lib/util/sendPush");
const {
  notifyCustomerAudience,
  notifyRole,
  notifyUser,
} = require("../lib/util/deliverNotification");

describe("notification delivery", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    sendPushNotification.mockClear();
    sendResendEmail.mockClear();
  });

  test("notifies an order customer by push and email with delivery metadata", async () => {
    const user = {
      _id: "customer-1",
      role: 2001,
      email: "customer@example.com",
      first_name: "Customer",
      last_name: "One",
    };
    const notification = { _id: { toString: () => "notification-1" } };
    const room = { emit: jest.fn() };
    const io = { to: jest.fn().mockReturnValue(room) };

    jest.spyOn(Notification, "create").mockResolvedValue(notification);
    sendResendEmail.mockResolvedValue({ id: "email-1" });
    sendPushNotification.mockResolvedValue([]);

    await notifyUser(io, user, {
      category: "order",
      title: "Order confirmed",
      message: "Delivery code: ABC123",
      orderId: "order-1",
      metadata: { deliveryCode: "ABC123" },
      channels: ["push", "email"],
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: user._id,
        recipient_id: user._id,
        recipient_model: "Customer",
        recipient_role: 2001,
      }),
    );
    expect(io.to).toHaveBeenCalledWith("customer_customer-1");
    expect(room.emit).toHaveBeenCalledWith("notification", notification);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user._id,
        userModel: "Customer",
        body: "Delivery code: ABC123",
        data: expect.objectContaining({ deliveryCode: "ABC123" }),
      }),
    );
    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: "Order confirmed",
        text: "Delivery code: ABC123",
      }),
    );
  });

  test("fans out admin notifications to role 5000 users", async () => {
    const admins = [
      { _id: "admin-1", role: 5000, email: "one@example.com" },
      { _id: "admin-2", role: 5000, email: "two@example.com" },
    ];
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(admins),
    };

    jest.spyOn(Customer, "find").mockReturnValue(query);
    jest.spyOn(Notification, "create").mockResolvedValue({});
    sendResendEmail.mockResolvedValue({ id: "email-1" });
    sendPushNotification.mockResolvedValue([]);

    await notifyRole(null, 5000, {
      category: "order",
      title: "New order",
      message: "An order was placed.",
      channels: ["push", "email"],
    });

    expect(Customer.find).toHaveBeenCalledWith({ role: 5000 });
    expect(sendPushNotification).toHaveBeenCalledTimes(2);
    expect(sendResendEmail).toHaveBeenCalledTimes(2);
  });

  test("sends marketing notifications only to customer-role devices", async () => {
    const query = {
      distinct: jest.fn().mockResolvedValue(["customer-1", "customer-2"]),
    };
    const notification = { _id: "notification-1" };
    const io = { emit: jest.fn() };

    jest.spyOn(Customer, "find").mockReturnValue(query);
    jest.spyOn(Notification, "create").mockResolvedValue(notification);
    sendPushNotification.mockResolvedValue([]);

    await notifyCustomerAudience(io, {
      category: "new_product",
      title: "New product",
      message: "A new product is available.",
      kind: "marketing",
    });

    expect(Customer.find).toHaveBeenCalledWith({ role: 2001 });
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["customer-1", "customer-2"],
        userModel: "Customer",
        kind: "marketing",
      }),
    );
    expect(io.emit).toHaveBeenCalledWith("notification", notification);
  });
});
