const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Cart = require("../models/Cart");

const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;
const SQUAD_BASE_URL = process.env.SQUAD_BASE_URL;

const DELIVERY_FEE = 500;
const SERVICE_CHARGE_RATE = 0.15;

const FRONTEND_URL = process.env.F_URL;
const MOBILE_APP_SCHEME = process.env.MOBILE_APP_SCHEME;

const PAYMENT_CHANNELS = ["card", "transfer", "ussd"];

function isSuccessStatus(status) {
  return String(status || "").toLowerCase() === "success";
}

function isTerminalFailureStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "failed" || normalized === "abandoned";
}

async function buildPendingOrder(customer_id, address) {
  const cartItems = await Cart.find({ customer_id }).populate("product_id");
  if (!cartItems.length) {
    const err = new Error("Cart is empty.");
    err.status = 400;
    err.isValidation = true; 
    throw err;
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product_id.product_price * item.product_quatity,
    0,
  );

  const subservice = Math.round(subtotal * SERVICE_CHARGE_RATE);
  const amount = Math.round(subtotal + DELIVERY_FEE + subservice);

  const pending = await PendingOrder.create({
    customer_id,
    address,
    products: cartItems.map((item) => ({
      product_id: item.product_id._id,
      product_quatity: item.product_quatity,
    })),
    amount,
    status: "pending",
  });

  return pending;
}

async function initializeTransaction(req, res) {
  const { customer_id, address, email, platform, callback_url } = req.body;
  if (!customer_id || !address || !email) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    const pending = await buildPendingOrder(customer_id, address);
    const reference = pending._id.toString();

    const squadPayload = {
      amount: pending.amount * 100,
      email: email,
      currency: "NGN",
      initiate_type: "inline",
      transaction_ref: reference,
      payment_channels: PAYMENT_CHANNELS,
    };

    // The client only tells us *which kind* of redirect it needs.
    if (platform === "mobile" && MOBILE_APP_SCHEME) {
      squadPayload.callback_url = `${MOBILE_APP_SCHEME}://order-status/${reference}`;
    } else if (FRONTEND_URL) {
      squadPayload.callback_url = `${FRONTEND_URL}/order-status/${reference}`;
    } else if (callback_url) {
      squadPayload.callback_url = callback_url;
    }

    const squadRes = await axios.post(
      `${SQUAD_BASE_URL}/transaction/initiate`,
      squadPayload,
      { headers: { Authorization: `Bearer ${SQUAD_SECRET_KEY}` } },
    );

    const data = squadRes.data.data;

    return res.status(200).send({
      reference,
      amount: pending.amount,
      checkout_url: data.checkout_url,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).send({ message: error.message });
    }
    console.error(
      "initializeTransaction error:",
      error?.response?.data || error,
    );
    const squadMessage = error?.response?.data?.message;
    return res.status(500).send({
       message: "Could not start payment." || squadMessage
      });
  }
}

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

  if (verifiedAmountKobo !== pending.amount * 100) {
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
    products: pending.products,
    customer_id: pending.customer_id,
    amount_paid: pending.amount,
    delivery_code: deliveryCode,
  });

  pending.status = "fulfilled";
  await pending.save();
  await Cart.deleteMany({ customer_id: pending.customer_id });

  return order;
}

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
          { headers: { Authorization: `Bearer ${SQUAD_SECRET_KEY}` } },
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