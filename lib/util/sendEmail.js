const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { transporter } = require("./transporter");

const sendEmail = async (recieverEmail, dataDetails, subject, emailFileName) => {
  // Read the email template file
  const templatePath = path.join(
    __dirname,
    "../..",
    "templates",
    "html",
    `${emailFileName}.html`
  );
  const templateSource = fs.readFileSync(templatePath, "utf8");
  handlebars.registerHelper('increment', function(value) {
    return parseInt(value) + 1;
  });
  
  const template = handlebars.compile(templateSource);

  // Generate the email HTML
  const emailHtml = template(dataDetails);

  // Email content
  const mailOptions = {
    from: "info@nushopa.com",
    to: `${recieverEmail}`, // Send to user email
    subject: `${subject}`,
    html: emailHtml,
  };
  
  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };