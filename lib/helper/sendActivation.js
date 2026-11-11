const { sendResendEmail } = require("../util/sendResendEmail");

async function sendActivationEmail(email, link) {
  await sendResendEmail({
    to: email,
    subject: "Activate Your Distributor Account",
    text: `Please activate your account using the following link: ${link}`,
  });
}
module.exports = {
  sendActivationEmail,
};
