const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder");
const Cart = require("../models/Cart");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DELIVERY_FEE = 1800;
const SERVICE_CHARGE_RATE = 0.15;

// Shared by both channels — computes the order total server-side so the
// client never gets to dictate the amount charged.
async function buildPendingOrder(customer_id, address) {
  const cartItems = await Cart.find({ customer_id }).populate("product_id");
  if (!cartItems.length) {
    const err = new Error("Cart is empty.");
    err.status = 400;
    throw err;
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product_id.product_price * item.product_quatity,
    0
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

// Web checkout — hosted Paystack page (card, transfer, USSD, etc. all
// selectable on Paystack's own UI, per your dashboard settings).
async function initializeTransaction(req, res) {
  const { customer_id, address, email, callback_url } = req.body;
  if (!customer_id || !address || !email) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    const pending = await buildPendingOrder(customer_id, address);

    const paystackPayload = {
      email,
      amount: pending.amount * 100,
      reference: pending._id.toString(),
    };

    // Mobile passes its deep-link scheme so Paystack's hosted checkout
    // redirects straight back into the app once the user finishes/cancels.
    // Web omits this and keeps using the inline popup.
    if (callback_url) {
      paystackPayload.callback_url = callback_url;
    }

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      paystackPayload,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    return res.status(200).send({
      reference: pending._id.toString(),
      amount: pending.amount,
      authorization_url: paystackRes.data.data.authorization_url,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).send({ message: error.message });
    }
    console.error("initializeTransaction error:", error?.response?.data || error);
    return res.status(500).send({ message: "Could not start payment." });
  }
}

// Mobile checkout — Pay with Transfer via the Charge API. Returns a
// temporary account number for a native "Deposit" style UI instead of
// redirecting anywhere.
async function initializeBankTransferCharge(req, res) {
  const { customer_id, address, email } = req.body;
  if (!customer_id || !address || !email) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    const pending = await buildPendingOrder(customer_id, address);

    const chargeRes = await axios.post(
      "https://api.paystack.co/charge",
      {
        email,
        amount: pending.amount * 100,
        reference: pending._id.toString(),
        bank_transfer: { account_expires_at: null }, // null = Paystack default (8hrs)
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const data = chargeRes.data.data;

    if (data.status !== "pending_bank_transfer") {
      console.error("Unexpected charge status:", data.status, data.display_text);
      pending.status = "failed";
      await pending.save();
      return res.status(502).send({ message: "Could not generate transfer account." });
    }

    return res.status(200).send({
      reference: pending._id.toString(),
      amount: pending.amount,
      account_name: data.account_name,
      account_number: data.account_number,
      bank_name: data.bank.name,
      account_expires_at: data.account_expires_at,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).send({ message: error.message });
    }
    console.error("initializeBankTransferCharge error:", error?.response?.data || error);
    return res.status(500).send({ message: "Could not start payment." });
  }
}

// Called by Paystack's servers, not the browser/app.
async function paystackWebhook(req, res) {
  const signature = req.headers["x-paystack-signature"];

  if (!req.rawBody) {
    console.error("paystackWebhook: req.rawBody missing — check express.json() verify hook in server.js.");
    return res.status(500).send("Server misconfiguration");
  }

  const expected = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex");

  if (signature !== expected) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body; // already parsed by express.json()

  try {
    if (event.event === "charge.success") {
      await fulfillOrder(event.data.reference, event.data.amount, event.data.status);
    } else if (event.event === "bank.transfer.rejected") {
      await rejectPendingTransfer(event.data.reference);
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
  }

  return res.sendStatus(200);
}

async function fulfillOrder(reference, verifiedAmountKobo, status) {
  const existingOrder = await Order.findOne({ orderID: reference });
  if (existingOrder) return existingOrder;

  const pending = await PendingOrder.findById(reference);
  if (!pending) throw new Error(`No pending order for reference ${reference}`);

  if (status !== "success") {
    pending.status = "failed";
    await pending.save();
    return null;
  }

  if (verifiedAmountKobo !== pending.amount * 100) {
    console.error(`Amount mismatch for ${reference} — flagging for review`);
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

// Customer sent the wrong amount, or was flagged by Paystack's fraud
// system — Paystack auto-refunds on their end, we just mark it failed
// so the app stops treating it as pending.
async function rejectPendingTransfer(reference) {
  const pending = await PendingOrder.findById(reference);
  if (!pending) {
    console.error(`bank.transfer.rejected: no pending order for reference ${reference}`);
    return;
  }
  if (pending.status === "pending") {
    pending.status = "failed";
    await pending.save();
  }
}

async function getOrderStatus(req, res) {
  const { reference } = req.params;
  try {
    const order = await Order.findOne({ orderID: reference });
    if (order) return res.status(200).send({ status: "fulfilled", order });

    const pending = await PendingOrder.findById(reference);
    if (!pending) return res.status(404).send({ status: "not_found" });

    return res.status(200).send({ status: pending.status });
  } catch (error) {
    console.error("getOrderStatus error:", error);
    return res.status(500).send({ message: "Could not retrieve order status." });
  }
}

module.exports = {
  initializeTransaction,
  initializeBankTransferCharge,
  paystackWebhook,
  getOrderStatus,
};