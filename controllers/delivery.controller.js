const axios = require("axios");
const DeliveryQuote = require("../models/DeliveryQuote");
const DeliveryProviderConfig = require("../models/DeliveryProviderConfig");
const PriceList = require("../models/PriceList");

const QUOTE_LIFETIME_MS = 15 * 60 * 1000;
const ALLOWED_METHODS = ["POST", "GET"];

function getValueAtPath(value, path) {
  return path
    .split(".")
    .reduce((current, segment) => current?.[segment], value);
}

function isValidProviderEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && url.protocol === "http:")
    );
  } catch {
    return false;
  }
}

function safeHost(endpoint) {
  try {
    const url = new URL(endpoint);
    return `${url.host}${url.pathname}`;
  } catch {
    return "invalid-endpoint";
  }
}

async function getFastDeliveryFee(config, address) {
  if (!config?.enabled || !config.endpoint || !config.apiKey) {
    return null;
  }

  // Defaults to POST. Set `method: "GET"` on the config document if the
  // provider's quote endpoint only accepts GET (the usual cause of a 405).
  const method = ALLOWED_METHODS.includes(config.method)
    ? config.method
    : "POST";

  const requestConfig = {
    url: config.endpoint,
    method,
    headers: { Authorization: `Bearer ${config.apiKey}` },
    timeout: 15000,
    maxRedirects: 0,
  };

  if (method === "GET") {
    requestConfig.params = {
      deliveryMode: "fast",
      currency: "NGN",
      address: JSON.stringify(address),
    };
  } else {
    requestConfig.data = { deliveryMode: "fast", address, currency: "NGN" };
  }

  const response = await axios(requestConfig);
  const fee = Number(getValueAtPath(response.data, config.feePath));
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error(
      `Fast delivery provider response must contain a non-negative fee at "${config.feePath}".`,
    );
  }
  return fee;
}

async function createDeliveryQuote(customerId, address, mode, fee) {
  const quote = await DeliveryQuote.create({
    customer_id: customerId,
    address,
    delivery_mode: mode,
    delivery_fee: fee,
    expiresAt: new Date(Date.now() + QUOTE_LIFETIME_MS),
  });
  return {
    deliveryMode: quote.delivery_mode,
    deliveryFee: quote.delivery_fee,
    quoteId: quote._id,
    expiresAt: quote.expiresAt,
  };
}

async function getDeliveryOptions(req, res, next) {
  const { customer_id, address } = req.body;
  const city = typeof address?.city === "string" ? address.city.trim() : "";

  if (!customer_id || !city || typeof address !== "object") {
    return res.status(422).send({
      message: "A customer and a delivery address with a city are required.",
    });
  }
  if (String(req.userId) !== String(customer_id)) {
    return res.status(403).send({
      message: "You can only request delivery quotes for your own account.",
    });
  }

  try {
    const cityPrice = await PriceList.findOne({ city });
    if (!cityPrice || !Number.isFinite(cityPrice.estimatePrice)) {
      return res.status(422).send({
        message: "Delivery is not available in the selected city.",
      });
    }

    const normalizedAddress = { ...address, city };
    const standard = await createDeliveryQuote(
      customer_id,
      normalizedAddress,
      "standard",
      cityPrice.estimatePrice,
    );
    const options = { standard, fast: { available: false } };
    const config = await DeliveryProviderConfig.findOne({
      key: "fast-delivery",
    });

    if (!config?.enabled || !config.endpoint || !config.apiKey) {
      options.fast.message = "Fast delivery is not configured.";
    } else {
      try {
        const fastFee = await getFastDeliveryFee(config, normalizedAddress);
        options.fast = {
          available: true,
          ...(await createDeliveryQuote(
            customer_id,
            normalizedAddress,
            "fast",
            fastFee,
          )),
        };
      } catch (error) {
        const status = error?.response?.status;
        console.error("Fast delivery quote failed:", {
          status: status || undefined,
          message: error?.response ? undefined : error.message,
          endpoint: safeHost(config.endpoint),
          method: config.method || "POST",
          // On a 405 the Allow header normally lists the accepted methods
          allow: error?.response?.headers?.allow,
          location: error?.response?.headers?.location,
          body: error?.response?.data,
        });
        if (status === 405) {
          console.error(
            "[delivery] 405 Method Not Allowed: the stored endpoint does not accept " +
              `${config.method || "POST"}. Check the provider docs for the correct quote ` +
              "URL and method, then update the fast-delivery config.",
          );
        }
        options.fast.message =
          "Fast delivery is temporarily unavailable. Please try standard delivery or retry.";
      }
    }

    return res.status(200).send({ options });
  } catch (error) {
    return next(error);
  }
}

async function getFastDeliveryConfig(req, res, next) {
  try {
    const config = await DeliveryProviderConfig.findOne({
      key: "fast-delivery",
    });
    return res.status(200).send({
      config: {
        endpoint: config?.endpoint || "",
        feePath: config?.feePath || "amount",
        method: ALLOWED_METHODS.includes(config?.method)
          ? config.method
          : "POST",
        enabled: Boolean(config?.enabled),
        hasApiKey: Boolean(config?.apiKey),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateFastDeliveryConfig(req, res, next) {
  const { endpoint, feePath, enabled, apiKey, method } = req.body;
  const normalizedEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
  const normalizedFeePath =
    typeof feePath === "string" ? feePath.trim() : "amount";
  const normalizedMethod =
    typeof method === "string" ? method.trim().toUpperCase() : "POST";

  if (
    typeof enabled !== "boolean" ||
    (normalizedEndpoint && !isValidProviderEndpoint(normalizedEndpoint)) ||
    !/^[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*$/.test(normalizedFeePath) ||
    !ALLOWED_METHODS.includes(normalizedMethod) ||
    (apiKey !== undefined && typeof apiKey !== "string")
  ) {
    return res.status(422).send({
      message:
        "Provide a valid HTTPS endpoint, fee response path, HTTP method (GET or POST), enabled flag, and optional API key.",
    });
  }

  try {
    const current = await DeliveryProviderConfig.findOne({
      key: "fast-delivery",
    });
    const effectiveApiKey =
      typeof apiKey === "string" && apiKey.trim()
        ? apiKey.trim()
        : current?.apiKey;
    if (enabled && (!normalizedEndpoint || !effectiveApiKey)) {
      return res.status(422).send({
        message:
          "A quote endpoint and API key must be configured before enabling fast delivery.",
      });
    }

    const update = {
      endpoint: normalizedEndpoint,
      feePath: normalizedFeePath,
      method: normalizedMethod,
      enabled,
    };
    if (typeof apiKey === "string" && apiKey.trim()) {
      update.apiKey = apiKey.trim();
    }

    const config = await DeliveryProviderConfig.findOneAndUpdate(
      { key: "fast-delivery" },
      { $set: update, $setOnInsert: { key: "fast-delivery" } },
      { new: true, upsert: true, runValidators: true },
    );
    return res.status(200).send({
      message: "Fast delivery provider settings saved.",
      config: {
        endpoint: config.endpoint,
        feePath: config.feePath,
        method: config.method || "POST",
        enabled: config.enabled,
        hasApiKey: Boolean(config.apiKey),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDeliveryOptions,
  getFastDeliveryConfig,
  updateFastDeliveryConfig,
};