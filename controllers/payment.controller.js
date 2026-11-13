const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Cart = require("../models/Cart");
const PriceList = require("../models/PriceList");
const DeliveryQuote = require("../models/DeliveryQuote");
const { notifyOrderPlaced } = require("../lib/util/notifyOrderPlaced");

const SQUAD_SECRET_KEY = (process.env.SQUAD_SECRET_KEY || "").trim();
const SQUAD_BASE_URL = (process.env.SQUAD_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const SERVICE_CHARGE_RATE = 0.15;

const FRONTEND_URL = (process.env.F_URL || "").trim().replace(/\/+$/, "");
const MOBILE_APP_SCHEME = (process.env.MOBILE_APP_SCHEME || "").trim();

const PAYMENT_CHANNELS = ["card", "transfer", "ussd"];


(function checkSquadConfig() {
  if (!SQUAD_SECRET_KEY || !SQUAD_BASE_URL) {
    console.error(
      "[squad] SQUAD_SECRET_KEY or SQUAD_BASE_URL is missing. " +
        "Make sure require('dotenv').config() is the FIRST line of server.js " +
        "and the variable names match exactly.",
    );
    return;
  }

  const keyIsSandbox = SQUAD_SECRET_KEY.startsWith("sandbox_");
  const urlIsSandbox = SQUAD_BASE_URL.includes("sandbox");

  if (/^(sandbox_)?pk_/.test(SQUAD_SECRET_KEY)) {
    console.error(
      "[squad] SQUAD_SECRET_KEY looks like a PUBLIC key (pk_). Use the secret key (sk_).",
    );
  }
  if (keyIsSandbox !== urlIsSandbox) {
    console.error(
      `[squad] Key/base URL mismatch: key is ${keyIsSandbox ? "SANDBOX" : "LIVE"} ` +
        `but base URL is ${urlIsSandbox ? "SANDBOX" : "LIVE"} (${SQUAD_BASE_URL}). ` +
        "Sandbox: https://sandbox-api-d.squadco.com  Live: https://api-d.squadco.com",
    );
  }

  console.log("[squad] config loaded", {
    baseUrl: SQUAD_BASE_URL,
    keyPrefix: SQUAD_SECRET_KEY.slice(0, 11),
    keyLength: SQUAD_SECRET_KEY.length,
    frontendUrl: FRONTEND_URL || "(not set)",
  });
})();

const squadHeaders = () => ({ Authorization: `Bearer ${SQUAD_SECRET_KEY}` });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isSuccessStatus(status) {
  return String(status || "").toLowerCase() === "success";
}

function isTerminalFailureStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "failed" || normalized === "abandoned";
}

function isSquadAuthError(error) {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || "").toLowerCase();
  return (
    status === 401 || status === 403 || message.includes("authentication")
  );
}

function buildCallbackUrl(base, reference) {
  try {
    return new URL(`/order-status/${reference}`, base).toString();
  } catch {
    console.error(
      `[squad] F_URL "${base}" is not a valid absolute URL (it needs https://). Omitting callback_url.`,
    );
    return undefined;
  }
}

function validationError(message, status = 422) {
  const err = new Error(message);
  err.status = status;
  err.isValidation = true;
  return err;
}

/* ------------------------------------------------------------------ */
/* Pending order                                                       */
/* ------------------------------------------------------------------ */

async function buildPendingOrder(customer_id, address, delivery_quote_id) {
  let orderAddress = address;
  let deliveryMode = "standard";
  let deliveryFee;

  if (delivery_quote_id) {
    const quote = await DeliveryQuote.findOne({
      _id: delivery_quote_id,
      customer_id,
      expiresAt: { $gt: new Date() },
    });
    if (!quote) {
      throw validationError(
        "The delivery quote has expired or is invalid. Please refresh checkout.",
      );
    }
    orderAddress = quote.address;
    deliveryMode = quote.delivery_mode;
    deliveryFee = quote.delivery_fee;
  } else {
    const city = typeof address?.city === "string" ? address.city.trim() : "";
    if (!city) {
      throw validationError("A delivery city is required.");
    }

    const deliveryPrice = await PriceList.findOne({ city });
    if (
      !deliveryPrice ||
      !Number.isFinite(deliveryPrice.estimatePrice) ||
      deliveryPrice.estimatePrice < 0
    ) {
      throw validationError("Delivery is not available in the selected city.");
    }
    deliveryFee = deliveryPrice.estimatePrice;
  }

  const cartItems = await Cart.find({ customer_id }).populate("product_id");
  if (!cartItems.length) {
    throw validationError("Cart is empty.", 400);
  }

  // A product deleted after being added to the cart populates as null.
  if (cartItems.some((item) => !item.product_id)) {
    throw validationError(
      "A product in your cart is no longer available. Please review your cart.",
    );
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product_id.product_price * item.product_quatity,
    0,
  );

  const subservice = Math.round(subtotal * SERVICE_CHARGE_RATE);
  const amount = Math.round(subtotal + deliveryFee + subservice);

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("[squad] Invalid order amount", {
      subtotal,
      deliveryFee,
      subservice,
      amount,
    });
    throw validationError("Could not calculate the order total.");
  }

  const pending = await PendingOrder.create({
    customer_id,
    address: orderAddress,
    delivery_mode: deliveryMode,
    delivery_fee: deliveryFee,
    products: cartItems.map((item) => ({
      product_id: item.product_id._id,
      product_quatity: item.product_quatity,
      product_name: item.product_id.product_name,
      unit_price: item.product_id.product_price,
    })),
    amount,
    status: "pending",
  });

  return pending;
}

/* ------------------------------------------------------------------ */
/* Initialise payment                                                  */
/* ------------------------------------------------------------------ */

async function initializeTransaction(req, res) {
  const {
    customer_id,
    address,
    delivery_quote_id,
    email,
    platform,
    callback_url,
  } = req.body;

  if (!customer_id || !address || !email) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  // Ownership check (mirrors getDeliveryOptions). Only enforced when the
  // route is behind auth middleware that sets req.userId.
  if (req.userId !== undefined && String(req.userId) !== String(customer_id)) {
    return res.status(403).send({
      message: "You can only start a payment for your own account.",
    });
  }

  if (!SQUAD_SECRET_KEY || !SQUAD_BASE_URL) {
    console.error("[squad] Cannot initialise: credentials are not configured.");
    return res.status(500).send({
      message: "Payments are temporarily unavailable. Please contact support.",
    });
  }

  // Declared outside try so the catch block can mark it failed.
  let pending = null;
  let squadPayload = null;

  try {
    pending = await buildPendingOrder(customer_id, address, delivery_quote_id);
    const reference = pending._id.toString();

    squadPayload = {
      amount: pending.amount * 100, // kobo
      email,
      currency: "NGN",
      initiate_type: "inline",
      transaction_ref: reference,
      payment_channels: PAYMENT_CHANNELS,
    };

    // The client only tells us *which kind* of redirect it needs.
    let cb;
    if (platform === "mobile" && MOBILE_APP_SCHEME) {
      cb = `${MOBILE_APP_SCHEME}://order-status/${reference}`;
    } else if (FRONTEND_URL) {
      cb = buildCallbackUrl(FRONTEND_URL, reference);
    } else if (callback_url) {
      cb = callback_url;
    }
    if (cb) squadPayload.callback_url = cb;

    if (!Number.isInteger(squadPayload.amount) || squadPayload.amount <= 0) {
      throw validationError("Could not calculate the order total.");
    }

    const squadRes = await axios.post(
      `${SQUAD_BASE_URL}/transaction/initiate`,
      squadPayload,
      { headers: squadHeaders(), timeout: 20000 },
    );

    const data = squadRes.data?.data;
    if (!data?.checkout_url) {
      throw new Error("Squad response did not include a checkout_url.");
    }

    return res.status(200).send({
      reference,
      amount: pending.amount,
      checkout_url: data.checkout_url,
    });
  } catch (error) {
    // Don't leave orphaned "pending" documents behind for failed attempts.
    if (pending?._id) {
      try {
        await PendingOrder.findOneAndUpdate(
          { _id: pending._id, status: "pending" },
          { status: "failed" },
        );
      } catch (cleanupErr) {
        console.error("[squad] Failed to mark pending order failed:", cleanupErr);
      }
    }

    if (error.isValidation) {
      return res.status(error.status || 400).send({ message: error.message });
    }

    console.error("initializeTransaction error:", {
      httpStatus: error?.response?.status,
      squad: error?.response?.data,
      error: error?.response ? undefined : error.message,
      sent: squadPayload
        ? { ...squadPayload, email: "[redacted]" }
        : "(payload not built)",
    });

    if (isSquadAuthError(error)) {
      console.error(
        "[squad] AUTHENTICATION FAILED. Check: (1) .env is loaded, (2) the key is the SECRET key, " +
          "(3) sandbox key <-> sandbox URL / live key <-> live URL, (4) the key was not regenerated.",
      );
      // Don't leak provider/config details to the browser.
      return res.status(500).send({
        message: "Payments are temporarily unavailable. Please contact support.",
      });
    }

    const squadMessage = error?.response?.data?.message;
    return res.status(500).send({
      message: squadMessage || "Could not start payment.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

async function squadWebhook(req, res) {
  const signature = req.headers["x-squad-signature"];

  if (!req.rawBody) {
    console.error(
      "squadWebhook: req.rawBody missing — check express.json() verify hook in server.js.",
    );
    return res.status(500).send("Server misconfiguration");
  }

  if (!signature) {
    return res.status(401).send("Missing signature");
  }

  const expected = crypto
    .createHmac("sha512", SQUAD_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex")
    .toUpperCase();

  const provided = signature.toUpperCase();

  const signatureIsValid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!signatureIsValid) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body; // already parsed by express.json()

  try {
    if (event.Event === "charge_successful") {
      const body = event.Body || {};
      await fulfillOrder(
        body.transaction_ref,
        body.amount,
        body.transaction_status,
      );
    } else if (
      event.Event === "charge_failed" ||
      event.Event === "transfer_failed" ||
      event.Event === "transfer_reversed"
    ) {
      const body = event.Body || {};
      await markPendingFailed(body.transaction_ref);
    } else {
      console.log("squadWebhook: unhandled event type", event.Event);
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
  }

  return res.sendStatus(200);
}

async function markPendingFailed(reference) {
  if (!reference) return;
  const existingOrder = await Order.findOne({ orderID: reference });
  if (existingOrder) return;

  const pending = await PendingOrder.findById(reference);
  if (!pending) {
    console.error(
      `markPendingFailed: no pending order for reference ${reference}`,
    );
    return;
  }
  if (pending.status === "pending") {
    pending.status = "failed";
    await pending.save();
  }
}

/* ------------------------------------------------------------------ */
/* Fulfilment                                                          */
/* ------------------------------------------------------------------ */

async function fulfillOrder(reference, verifiedAmountKobo, status) {
  const existingOrder = await Order.findOne({ orderID: reference });
  if (existingOrder) return existingOrder;

  if (!isSuccessStatus(status)) {
    await PendingOrder.findOneAndUpdate(
      { _id: reference, status: "pending" },
      { status: "failed" },
    );
    return null;
  }

  const pending = await PendingOrder.findOneAndUpdate(
    { _id: reference, status: "pending" },
    { status: "processing" },
    { new: true },
  );

  if (!pending) {
    const raceOrder = await Order.findOne({ orderID: reference });
    if (raceOrder) return raceOrder;

    const stillExists = await PendingOrder.findById(reference);
    if (!stillExists) {
      throw new Error(`No pending order for reference ${reference}`);
    }
    return null;
  }

  if (Number(verifiedAmountKobo) !== pending.amount * 100) {
    console.error(
      `Amount mismatch for ${reference}: expected ${pending.amount * 100}, got ${verifiedAmountKobo}. Flagging for review instead of fulfilling.`,
    );
    pending.status = "flagged_for_review";
    await pending.save();
    return null;
  }

  const deliveryCode = crypto.randomBytes(4).toString("hex").toUpperCase();

  const order = await Order.create({
    orderID: reference,
    address: pending.address,
    delivery_mode: pending.delivery_mode,
    delivery_fee: pending.delivery_fee,
    products: pending.products,
    customer_id: pending.customer_id,
    amount_paid: pending.amount,
    delivery_code: deliveryCode,
  });

  pending.status = "fulfilled";
  await pending.save();
  await Cart.deleteMany({ customer_id: pending.customer_id });
  try {
    await notifyOrderPlaced(null, order);
  } catch (error) {
    console.error("Failed to notify order recipients:", error);
  }

  return order;
}

/* ------------------------------------------------------------------ */
/* Order status (polled by the frontend)                               */
/* ------------------------------------------------------------------ */

async function getOrderStatus(req, res) {
  const { reference } = req.params;
  try {
    const order = await Order.findOne({ orderID: reference });
    if (order) return res.status(200).send({ status: "fulfilled", order });

    let pending = await PendingOrder.findById(reference);
    if (!pending) return res.status(404).send({ status: "not_found" });

    if (pending.status === "pending") {
      try {
        const verifyRes = await axios.get(
          `${SQUAD_BASE_URL}/transaction/verify/${reference}`,
          { headers: squadHeaders(), timeout: 20000 },
        );
        const verifyData = verifyRes.data?.data;

        if (isSuccessStatus(verifyData?.transaction_status)) {
          const fulfilled = await fulfillOrder(
            reference,
            verifyData.transaction_amount,
            verifyData.transaction_status,
          );
          if (fulfilled) {
            return res
              .status(200)
              .send({ status: "fulfilled", order: fulfilled });
          }
        } else if (isTerminalFailureStatus(verifyData?.transaction_status)) {
          pending.status = "failed";
          await pending.save();
        }
      } catch (verifyErr) {
        console.error(
          "getOrderStatus verify fallback error:",
          verifyErr?.response?.data || verifyErr,
        );
      }
    }

    pending = await PendingOrder.findById(reference);
    return res
      .status(200)
      .send({ status: pending ? pending.status : "not_found" });
  } catch (error) {
    console.error("getOrderStatus error:", error);
    return res
      .status(500)
      .send({ message: "Could not retrieve order status." });
  }
}

module.exports = {
  initializeTransaction,
  squadWebhook,
  getOrderStatus,
};