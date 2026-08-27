const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/Order");
const PendingOrder = require("../models/PendingOrder"); // new model, see below
const Cart = require("../models/Cart");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const DELIVERY_FEE = 1800;
const SERVICE_CHARGE_RATE = 0.15;

// 1. Frontend calls this BEFORE opening the Paystack popup.
async function initializeTransaction(req, res) {
  const { customer_id, address, email } = req.body;
  if (!customer_id || !address || !email) {
    return res.status(422).send({ message: "All fields are required!" });
  }

  try {
    const cartItems = await Cart.find({ customer_id }).populate("product_id");
    if (!cartItems.length) {
      return res.status(400).send({ message: "Cart is empty." });
    }

    // Never trust a client-supplied total.
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.product_id.product_price * item.product_quatity,
      0
    );
    const amount = Math.round(subtotal + DELIVERY_FEE + subtotal * SERVICE_CHARGE_RATE);

    const pending = await PendingOrder.create({
      customer_id,
      address,
      products: cartItems,
      amount,
      status: "pending",
    });

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100, // kobo
        reference: pending._id.toString(),
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    return res.status(200).send({
      reference: pending._id.toString(),
      amount,
      authorization_url: paystackRes.data.data.authorization_url,
    });
  } catch (error) {
    console.error("initializeTransaction error:", error?.response?.data || error);
    return res.status(500).send({ message: "Could not start payment." });
  }
}

// 2. Paystack calls this server-to-server. Works for every channel.
async function paystackWebhook(req, res) {
  const signature = req.headers["x-paystack-signature"];
  const expected = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.body) // raw Buffer — see route note below
    .digest("hex");

  if (signature !== expected) {
    return res.status(401).send("Invalid signature");
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === "charge.success") {
    try {
      await fulfillOrder(event.data.reference, event.data.amount, event.data.status);
    } catch (err) {
      console.error("Webhook fulfillment error:", err);
    }
  }

  return res.sendStatus(200); // ack quickly regardless
}

// Idempotent — safe to call from the webhook AND from a client "check status" hit.
async function fulfillOrder(reference, verifiedAmountKobo, status) {
  const existingOrder = await Order.findOne({ orderID: reference });
  if (existingOrder) return existingOrder; // already handled

  const pending = await PendingOrder.findById(reference);
  if (!pending) throw new Error(`No pending order for reference ${reference}`);

  if (status !== "success") {
    pending.status = "failed";
    await pending.save();
    return null;
  }

  if (verifiedAmountKobo !== pending.amount * 100) {
    console.error(`Amount mismatch for ${reference} — flagging for review`);
    // handle as you see fit — don't silently trust it
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

// 3. Frontend polls this after the popup closes.
async function getOrderStatus(req, res) {
  const { reference } = req.params;
  const order = await Order.findOne({ orderID: reference });
  if (order) return res.status(200).send({ status: "fulfilled", order });

  const pending = await PendingOrder.findById(reference);
  if (!pending) return res.status(404).send({ status: "not_found" });
  return res.status(200).send({ status: pending.status }); // "pending" | "failed"
}

module.exports = { initializeTransaction, paystackWebhook, getOrderStatus };