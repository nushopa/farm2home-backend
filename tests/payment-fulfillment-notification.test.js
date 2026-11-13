jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../models/Order", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../models/PendingOrder", () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../models/Cart", () => ({ deleteMany: jest.fn() }));
jest.mock("../models/PriceList", () => ({ findOne: jest.fn() }));
jest.mock("../models/DeliveryQuote", () => ({ findOne: jest.fn() }));
jest.mock("../lib/util/notifyOrderPlaced", () => ({
  notifyOrderPlaced: jest.fn().mockResolvedValue(),
}));

process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
process.env.SQUAD_BASE_URL = "https://sandbox-api-d.squadco.com";

const axios = require("axios");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Cart = require("../models/Cart");
const { notifyOrderPlaced } = require("../lib/util/notifyOrderPlaced");
const { getOrderStatus } = require("../controllers/payment.controller");

describe("payment fulfillment notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notifies recipients when a verified payment creates an order", async () => {
    const pendingOrder = {
      _id: "pending-1",
      customer_id: "customer-1",
      address: { city: "Ikeja" },
      products: [
        {
          product_id: "product-1",
          product_quatity: 1,
          product_name: "Apples",
          unit_price: 1000,
        },
      ],
      amount: 1150,
      delivery_fee: 0,
      delivery_mode: "standard",
      status: "pending",
    };
    const claimedPendingOrder = {
      ...pendingOrder,
      status: "processing",
      save: jest.fn().mockResolvedValue(),
    };
    const order = { orderID: "pending-1", customer_id: "customer-1" };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    Order.findOne.mockResolvedValue(null);
    Order.create.mockResolvedValue(order);
    PendingOrder.findById.mockResolvedValue(pendingOrder);
    PendingOrder.findOneAndUpdate.mockResolvedValue(claimedPendingOrder);
    Cart.deleteMany.mockResolvedValue({ deletedCount: 1 });
    axios.get.mockResolvedValue({
      data: {
        data: {
          transaction_status: "Success",
          transaction_amount: 115000,
        },
      },
    });

    await getOrderStatus({ params: { reference: "pending-1" } }, res);

    expect(notifyOrderPlaced).toHaveBeenCalledWith(null, order);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      status: "fulfilled",
      order,
    });
  });
});
