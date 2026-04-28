const { transporter } = require("../util/transporter");

async function sendActivationEmail(email, link) {
 
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Activate Your Distributor Account",
    text: `Please activate your account using the following link: ${link}`,
  };

  await transporter.sendMail(mailOptions);
}
module.exports = {
  sendActivationEmail,
};