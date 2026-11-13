// lib/util/onboarding.js
const { sendResendEmail } = require("./sendResendEmail");
const { notifyAdminAction, escapeHtml } = require("./deliverNotification");

const WELCOME = {
  customer: {
    subject: "Welcome to Nushopa - your shopping starts here",
    heading: "Welcome to Nushopa!",
    intro:
      "Your customer account is ready. Nushopa connects you with fresh farm produce and everyday groceries from trusted local suppliers, with convenient home delivery.",
    steps: [
      "Browse the store to discover fresh produce and other everyday essentials.",
      "Add the products you want to your cart and provide your delivery details at checkout.",
      "Place your order, then follow its progress from your account.",
    ],
    action: "Start shopping",
  },
  marketrep: {
    subject: "Welcome to the Nushopa market rep team",
    heading: "Welcome to the Nushopa team!",
    intro:
      "Your market rep account is ready. Market reps help Nushopa fulfill customer orders by coordinating the work on orders assigned to them and keeping customers' orders moving toward successful completion.",
    steps: [
      "Check your dashboard and notifications for orders assigned to you.",
      "Review each order's products and customer details, and coordinate its fulfillment.",
      "Keep order information up to date and confirm completion with the customer's delivery code when required.",
      "Contact the Nushopa team promptly if an assignment needs attention or you encounter a problem.",
    ],
  },
  rider: {
    subject: "Welcome aboard, Nushopa rider \ud83d\udeb4",
    heading: "Welcome aboard!",
    intro: "Once you're verified, delivery assignments will appear in your app.",
    steps: [],
  },
};

async function sendWelcomeEmail(type, { email, firstName }) {
  const w = WELCOME[type];
  if (!w) throw new Error(`Unsupported welcome email type: ${type}`);
  if (!email) throw new Error("A recipient email is required for a welcome email.");

  const greetingName = firstName || "there";
  let shoppingUrl;
  if (type === "customer") {
    if (!process.env.F_URL) {
      throw new Error("F_URL is required for customer welcome emails.");
    }
    shoppingUrl = new URL("/", process.env.F_URL).toString();
  }
  const stepsText = w.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const stepsHtml = w.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  const text = [
    `Hi ${greetingName},`,
    w.heading,
    w.intro,
    ...(w.steps.length ? [`Here's how to get started:\n${stepsText}`] : []),
    ...(shoppingUrl
      ? [`${w.action}: ${shoppingUrl}`]
      : []),
  ].join("\n\n");
  const actionHtml = shoppingUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(shoppingUrl)}" style="display:inline-block;background:#0f8128;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(w.action)}</a></p>`
    : "";

  await sendResendEmail({
    to: email,
    subject: w.subject,
    text,
    html: `<h2>Hi ${escapeHtml(greetingName)},</h2><h3>${escapeHtml(w.heading)}</h3><p>${escapeHtml(w.intro)}</p>${w.steps.length ? `<h4>Here's how to get started:</h4><ol>${stepsHtml}</ol>` : ""}${actionHtml}`,
  });
}

async function notifyAdminOnboarded(io, type, user) {
  const label = { customer: "Customer", marketrep: "Market rep", rider: "Rider" }[type];
  const name = [user.first_name ?? user.firstName, user.last_name ?? user.lastName].filter(Boolean).join(" ");
  await notifyAdminAction(io, {
    category: "onboarding",
    title: `${label} fully onboarded`,
    message: `${name || user.email} has completed onboarding as a ${label.toLowerCase()}.`,
    metadata: { userId: String(user._id), userType: type },
    channels: ["push", "email"],
  });
}
module.exports = { sendWelcomeEmail, notifyAdminOnboarded };