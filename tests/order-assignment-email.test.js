jest.mock("../models/Customer", () => ({
  findById: jest.fn(),
}));
jest.mock("../models/Product", () => ({
  find: jest.fn(),
}));
jest.mock("../lib/util/sendEmail", () => ({
  sendEmail: jest.fn().mockResolvedValue({ id: "email-1" }),
}));

const Customer = require("../models/Customer");
const Product = require("../models/Product");
const { sendEmail } = require("../lib/util/sendEmail");
const {
  sendDetailedOrderAssignedEmail,
} = require("../lib/sendAssignmentEmail");

describe("detailed order assignment email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Customer.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        first_name: "Ava",
        last_name: "Customer",
        phone_number: "08000000000",
      }),
    });
    Product.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: "product-1", product_name: "Apples", product_price: 500 },
      ]),
    });
  });

  it("sends order items, amount, address, and customer contact to the assignee", async () => {
    const order = {
      orderID: "order-1",
      customer_id: "customer-1",
      products: [
        {
          product_id: "product-1",
          product_quatity: 2,
          product_name: "Apples",
          unit_price: 500,
        },
      ],
      address: { address: "1 Market Road", city: "Ikeja", state: "Lagos" },
      amount_paid: 1350,
      delivery_fee: 200,
      delivery_mode: "standard",
    };

    await sendDetailedOrderAssignedEmail(
      order,
      { email: "rider@example.com", firstName: "Sam" },
      "rider",
    );

    expect(sendEmail).toHaveBeenCalledWith(
      "rider@example.com",
      expect.objectContaining({
        recipientName: "Sam",
        recipientRole: "rider",
        orderID: "order-1",
        deliveryAddress: "1 Market Road, Ikeja, Lagos",
        customerName: "Ava Customer",
        customerPhone: "08000000000",
        amountPaid: "₦1,350",
        items: [
          expect.objectContaining({
            name: "Apples",
            quantity: 2,
            unitPrice: "₦500",
            lineTotalFormatted: "₦1,000",
          }),
        ],
      }),
      "Order order-1 assigned to you",
      "order-assigned",
    );
    expect(sendEmail.mock.calls[0][1]).not.toHaveProperty("deliveryCode");
  });
});
