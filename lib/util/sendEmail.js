const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { sendResendEmail } = require("./sendResendEmail");

const sendEmail = async (
  recipientEmail,
  dataDetails,
  subject,
  emailFileName,
) => {
  const templatePath = path.join(
    __dirname,
    "../..",
    "templates",
    "html",
    `${emailFileName}.html`,
  );
  const templateSource = fs.readFileSync(templatePath, "utf8");

  handlebars.registerHelper("increment", function (value) {
    return parseInt(value) + 1;
  });

  const template = handlebars.compile(templateSource);
  const emailHtml = template(dataDetails);

  return sendResendEmail({
    to: recipientEmail,
    subject,
    html: emailHtml,
  });
};

module.exports = { sendEmail };
