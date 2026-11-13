const { sendResendEmail } = require("./util/sendResendEmail");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const formatNaira = (amount) =>
  `₦${Number(amount || 0).toLocaleString("en-NG")}`;

async function sendOrderConfirmationEmail({
  customerFirstName,
  customerEmail,
  deliveryCode,
  orderID,
  items = [],
  subtotal,
  deliveryFee,
  serviceFee,
  amountPaid,
  deliveryMode,
  deliveryAddress,
}) {
  if (!customerEmail) {
    console.warn(`Cannot send order ${orderID} confirmation: customer has no email.`);
    return;
  }

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">${escapeHtml(item.name)}</td>
          <td style="padding:10px;border:1px solid #ddd;text-align:center;">${escapeHtml(item.quantity)}</td>
          <td style="padding:10px;border:1px solid #ddd;text-align:right;">${formatNaira(item.price)}</td>
          <td style="padding:10px;border:1px solid #ddd;text-align:right;">${formatNaira(item.lineTotal)}</td>
        </tr>`,
    )
    .join("");
  const itemText = items
    .map(
      (item) =>
        `${item.quantity} x ${item.name} — ${formatNaira(item.lineTotal)} (unit ${formatNaira(item.price)})`,
    )
    .join("\n");
  const deliveryModeLabel =
    deliveryMode === "fast" ? "Fast delivery" : "Standard delivery";
  const html = `
    <table style="width:100%;font-family:Arial,sans-serif;border-collapse:collapse;background:#f9f9f9;">
      <tr>
        <td style="text-align:center;padding:20px;background:#007145;color:#fff;font-size:24px;font-weight:bold;">Nushopa</td>
      </tr>
      <tr>
        <td style="padding:20px;color:#333;">
          <h2 style="color:#007145;">Hello, ${escapeHtml(customerFirstName)}</h2>
          <p>Thank you for your order. Here is the full receipt and delivery information.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:10px;background:#f2f2f2;border:1px solid #ddd;"><strong>Order ID</strong></td><td style="padding:10px;border:1px solid #ddd;">${escapeHtml(orderID)}</td></tr>
            <tr><td style="padding:10px;background:#f2f2f2;border:1px solid #ddd;"><strong>Delivery method</strong></td><td style="padding:10px;border:1px solid #ddd;">${deliveryModeLabel}</td></tr>
            <tr><td style="padding:10px;background:#f2f2f2;border:1px solid #ddd;"><strong>Delivery address</strong></td><td style="padding:10px;border:1px solid #ddd;">${escapeHtml(deliveryAddress)}</td></tr>
          </table>
          <h3 style="color:#007145;">Items ordered</h3>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="padding:10px;border:1px solid #ddd;text-align:left;">Item</th>
              <th style="padding:10px;border:1px solid #ddd;">Qty</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:right;">Unit price</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:right;">Item total</th>
            </tr></thead>
            <tbody>${itemRows || '<tr><td colspan="4" style="padding:10px;border:1px solid #ddd;">Order items</td></tr>'}</tbody>
          </table>
          <table style="width:100%;border-collapse:collapse;margin-top:20px;">
            <tr><td style="padding:8px;"><strong>Subtotal</strong></td><td style="padding:8px;text-align:right;">${formatNaira(subtotal)}</td></tr>
            <tr><td style="padding:8px;"><strong>Delivery fee</strong></td><td style="padding:8px;text-align:right;">${formatNaira(deliveryFee)}</td></tr>
            <tr><td style="padding:8px;"><strong>Service fee</strong></td><td style="padding:8px;text-align:right;">${formatNaira(serviceFee)}</td></tr>
            <tr><td style="padding:10px;border-top:2px solid #333;"><strong>Amount paid</strong></td><td style="padding:10px;border-top:2px solid #333;text-align:right;"><strong>${formatNaira(amountPaid)}</strong></td></tr>
          </table>
          <h3 style="margin-top:24px;color:#007145;">Your delivery code: ${escapeHtml(deliveryCode)}</h3>
          <p><strong>Keep this code private.</strong> Share it only with your rider when your order is delivered.</p>
          <p>Questions? Contact <a href="mailto:support@nushopa.ng" style="color:#007145;">support@nushopa.ng</a>.</p>
        </td>
      </tr>
      <tr><td style="text-align:center;padding:10px;background:#007145;color:#fff;">&copy; Nushopa. All rights reserved.</td></tr>
    </table>
  `;
  const text = [
    `Hello, ${customerFirstName}`,
    `Order ID: ${orderID}`,
    `Delivery method: ${deliveryModeLabel}`,
    `Delivery address: ${deliveryAddress}`,
    "Items:",
    itemText || "Order items",
    `Subtotal: ${formatNaira(subtotal)}`,
    `Delivery fee: ${formatNaira(deliveryFee)}`,
    `Service fee: ${formatNaira(serviceFee)}`,
    `Amount paid: ${formatNaira(amountPaid)}`,
    `Delivery code: ${deliveryCode}`,
    "Keep this code private and share it only with your rider when your order is delivered.",
  ].join("\n");

  await sendResendEmail({
    to: customerEmail,
    subject: `Order ${orderID} confirmed — Nushopa`,
    text,
    html,
  });
}

module.exports = { sendOrderConfirmationEmail };
