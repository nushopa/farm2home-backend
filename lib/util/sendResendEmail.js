const { Resend } = require("resend");

let resendClient;
let configuredApiKey;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send email.");
  }

  if (!resendClient || configuredApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    configuredApiKey = apiKey;
  }

  return resendClient;
}

async function sendResendEmail({ to, subject, text, html }) {
  const from = process.env.RESEND_FROM?.trim();
  if (!from) {
    throw new Error("RESEND_FROM is required to send email.");
  }
  if (!to || !subject || (!text && !html)) {
    throw new Error("Email recipient, subject, and content are required.");
  }

  const { data, error } = await getResendClient().emails.send({
    from,
    to,
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }
  if (!data) {
    throw new Error("Resend returned no email result.");
  }

  return data;
}

module.exports = { sendResendEmail };
