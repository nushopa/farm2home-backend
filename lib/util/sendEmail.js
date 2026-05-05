const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
//const { transporter } = require("./transporter");
 const {Resend} = require("resend");


 const resend = new Resend(process.env.RESEND_API_KEY);

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
  /*const mailOptions = {
    from: "Nushopa <info@nushopa.com>",
    to: `${recieverEmail}`, // Send to user email
    subject: `${subject}`,
    html: emailHtml,
  };*/

  const { data, error } = await resend.emails.send({ 
    //from: "Nushopa <info@nushopa.com>",
    //to: recieverEmail,
    from: "Nushopa <onboarding@resend.dev>",
    to: "victor.interface23@gmail.com",
    subject: subject,
    html: emailHtml,
  });
  
  //await transporter.sendMail(mailOptions);
 if (error) {
  console.error("Resend error:", JSON.stringify(error));
  throw new Error(JSON.stringify(error)); // ✅ now the real error shows in the browser/response
}

  return data;
};

module.exports = { sendEmail };