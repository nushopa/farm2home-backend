const { transporter } = require("./util/transporter");

async function sendOrderConfirmationEmail(
  customerFirstName,
  customerEmail,
  deliveryCode,
  orderID
) {

  const mailOptions = {
    from: "info@nushopa.com",
    to: customerEmail,
    subject: "✨ Your Order Confirmation and Delivery Code",
    html: `
      <table style="width: 100%; font-family: Arial, sans-serif; border-collapse: collapse; background-color: #f9f9f9; padding: 20px;">
        <tr>
          <td style="text-align: center; padding: 20px; background-color: #007145; color: #ffffff; font-size: 24px; font-weight: bold;">
            Nushopa
          </td>
        </tr>
        <tr>
          <td style="padding: 20px; color: #333333;">
            <h2 style="font-size: 22px; color: #007145;">Hello, ${customerFirstName}</h2>
            <p style="font-size: 16px; line-height: 1.6;">
              Thank you for placing an order with us! We’re delighted to confirm that your order has been successfully processed. Below are your order details:
            </p>
            <table style="width: 100%; border: 1px solid #dddddd; margin-top: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; background-color: #f2f2f2; font-weight: bold; border: 1px solid #dddddd;">Order ID</td>
                <td style="padding: 10px; border: 1px solid #dddddd;">${orderID}</td>
              </tr>
              <tr>
                <td style="padding: 10px; background-color: #f2f2f2; font-weight: bold; border: 1px solid #dddddd;">Delivery Code</td>
                <td style="padding: 10px; border: 1px solid #dddddd; color: #007145; font-weight: bold;">${deliveryCode}</td>
              </tr>
            </table>
            <p style="font-size: 16px; line-height: 1.6; margin-top: 20px; color: #ff0000;">
              <strong>Important:</strong> Please do not share your delivery code with anyone. This code is essential to verify your order upon delivery.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              If you have any questions or concerns, feel free to contact us at 
              <a href="mailto:info@nushopa.com" style="color: #007145; text-decoration: none;">support@nushopa.ng</a> 
            </strong>.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              Thank you for choosing <strong>Nushopa</strong>! We look forward to serving you again.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding: 10px; background-color: #007145; color: #ffffff; font-size: 14px;">
            &copy; 2024 Nushopa. All Rights Reserved.
          </td>
        </tr>
      </table>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Order confirmation email sent successfully.");
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}

module.exports = {
  sendOrderConfirmationEmail,
};