// Squad config is read when payment.controller loads, so set it first.
process.env.SQUAD_SECRET_KEY = "sandbox_sk_test";
process.env.SQUAD_BASE_URL = "https://sandbox-api-d.squadco.com";

jest.mock("axios", () => {
  const axios = jest.fn();
  axios.post = jest.fn();
  return axios;
});

// Stop the firebase chain from loading in CI:
// payment.controller -> notifyOrderPlaced -> deliverNotification -> sendPush -> firebaseAdmin
jest.mock("../lib/firebaseAdmin", () => ({
  getCredential: jest.fn(),
  admin: { messaging: () => ({ send: jest.fn() }) },
}));
jest.mock("../lib/util/notifyOrderPlaced", () => {
  const fn = jest.fn();
  fn.notifyOrderPlaced = fn; // supports default and named imports
  return fn;
});

jest.mock("../models/Order", () => ({}));
jest.mock("../models/PendingOrder", () => ({ create: jest.fn() }));
jest.mock("../models/Cart", () => ({ find: jest.fn() }));
jest.mock("../models/PriceList", () => ({ findOne: jest.fn() }));
jest.mock("../models/DeliveryQuote", () => ({ findOne: jest.fn() }));

const axios = require("axios");
const PendingOrder = require("../models/PendingOrder");
const Cart = require("../models/Cart");
const PriceList = require("../models/PriceList");
const DeliveryQuote = require("../models/DeliveryQuote");
const { initializeTransaction } = require("../controllers/payment.controller");

describe("initializeTransaction delivery quote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DeliveryQuote.findOne.mockResolvedValue({
      address: { city: "Ikeja", address: "10 Market Road" },
      delivery_mode: "fast",
      delivery_fee: 1250,
    });
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        {
          product_id: { _id: "product-1", product_price: 1000 },
          product_quatity: 2,
        },
      ]),
    });
    PendingOrder.create.mockImplementation(async (pending) => ({
      ...pending,
      _id: "pending-1",
    }));
    axios.post.mockResolvedValue({
      data: { data: { checkout_url: "https://pay.example/checkout" } },
    });
  });

  it("prices and records the selected delivery mode server-side", async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await initializeTransaction(
      {
        body: {
          customer_id: "customer-1",
          address: { city: "Ikeja" },
          delivery_quote_id: "quote-fast",
          email: "customer@example.com",
        },
      },
      res,
    );

    expect(PriceList.findOne).not.toHaveBeenCalled();
    expect(PendingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "fast",
        delivery_fee: 1250,
        amount: 3550,
      }),
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3550 }),
    );
  });
});