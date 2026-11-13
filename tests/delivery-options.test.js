jest.mock("axios", () => {
  const axios = jest.fn();
  axios.post = jest.fn();
  return axios;
});
jest.mock("../models/DeliveryQuote", () => ({ create: jest.fn() }));
jest.mock("../models/DeliveryProviderConfig", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../models/PriceList", () => ({ findOne: jest.fn() }));

const axios = require("axios");
const DeliveryQuote = require("../models/DeliveryQuote");
const DeliveryProviderConfig = require("../models/DeliveryProviderConfig");
const PriceList = require("../models/PriceList");
const {
  getDeliveryOptions,
  getFastDeliveryConfig,
  updateFastDeliveryConfig,
} = require("../controllers/delivery.controller");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

describe("getDeliveryOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockReset();
    PriceList.findOne.mockResolvedValue({ estimatePrice: 800 });
    DeliveryProviderConfig.findOne.mockResolvedValue({
      enabled: true,
      endpoint: "https://courier.example/quote",
      apiKey: "test-token",
      feePath: "data.deliveryFee",
    });
    DeliveryQuote.create.mockImplementation(async (quote) => ({
      ...quote,
      _id: `quote-${quote.delivery_mode}`,
    }));
  });

  it("returns standard and fast quotes using the configured provider response fee", async () => {
    axios.mockResolvedValue({ data: { data: { deliveryFee: "1250" } } });
    const req = {
      userId: "customer-1",
      body: {
        customer_id: "customer-1",
        address: { city: "Ikeja", address: "10 Market Road" },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await getDeliveryOptions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://courier.example/quote",
        method: "POST",
        data: {
          deliveryMode: "fast",
          address: { city: "Ikeja", address: "10 Market Road" },
          currency: "NGN",
        },
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(DeliveryQuote.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ delivery_mode: "standard", delivery_fee: 800 }),
    );
    expect(DeliveryQuote.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ delivery_mode: "fast", delivery_fee: 1250 }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      options: {
        standard: expect.objectContaining({
          deliveryMode: "standard",
          deliveryFee: 800,
          quoteId: "quote-standard",
        }),
        fast: expect.objectContaining({
          available: true,
          deliveryMode: "fast",
          deliveryFee: 1250,
          quoteId: "quote-fast",
        }),
      },
    });
  });

  it("sends the quote as a GET with query params when the config method is GET", async () => {
    DeliveryProviderConfig.findOne.mockResolvedValue({
      enabled: true,
      endpoint: "https://courier.example/quote",
      apiKey: "test-token",
      feePath: "data.deliveryFee",
      method: "GET",
    });
    axios.mockResolvedValue({ data: { data: { deliveryFee: 900 } } });
    const res = createResponse();

    await getDeliveryOptions(
      {
        userId: "customer-1",
        body: { customer_id: "customer-1", address: { city: "Ikeja" } },
      },
      res,
      jest.fn(),
    );

    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        params: {
          deliveryMode: "fast",
          currency: "NGN",
          address: JSON.stringify({ city: "Ikeja" }),
        },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("keeps standard delivery available when the provider quote fails", async () => {
    axios.mockRejectedValue(new Error("provider unavailable"));
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});
    const req = {
      userId: "customer-1",
      body: {
        customer_id: "customer-1",
        address: { city: "Ikeja" },
      },
    };
    const res = createResponse();

    await getDeliveryOptions(req, res, jest.fn());

    expect(axios).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      options: {
        standard: expect.objectContaining({ deliveryFee: 800 }),
        fast: {
          available: false,
          message:
            "Fast delivery is temporarily unavailable. Please try standard delivery or retry.",
        },
      },
    });
    logError.mockRestore();
  });

  it("rejects quotes requested for a different customer", async () => {
    const res = createResponse();

    await getDeliveryOptions(
      {
        userId: "customer-1",
        body: {
          customer_id: "customer-2",
          address: { city: "Ikeja" },
        },
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(PriceList.findOne).not.toHaveBeenCalled();
  });

  it("does not return the configured provider API key to the admin client", async () => {
    DeliveryProviderConfig.findOne.mockResolvedValue({
      endpoint: "https://courier.example/quote",
      apiKey: "private-token",
      feePath: "data.deliveryFee",
      enabled: true,
    });
    const res = createResponse();

    await getFastDeliveryConfig({}, res, jest.fn());

    expect(res.send).toHaveBeenCalledWith({
      config: {
        endpoint: "https://courier.example/quote",
        feePath: "data.deliveryFee",
        method: "POST",
        enabled: true,
        hasApiKey: true,
      },
    });
    expect(JSON.stringify(res.send.mock.calls[0])).not.toContain("private-token");
  });

  it("requires an endpoint and API key before enabling fast delivery", async () => {
    DeliveryProviderConfig.findOne.mockResolvedValue(null);
    const res = createResponse();

    await updateFastDeliveryConfig(
      {
        body: {
          endpoint: "https://courier.example/quote",
          feePath: "amount",
          enabled: true,
        },
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(DeliveryProviderConfig.findOneAndUpdate).not.toHaveBeenCalled();
  });
});