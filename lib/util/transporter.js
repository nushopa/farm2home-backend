const nodemailer = require("nodemailer");

const createTransporter = (port, secure) =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: {
      rejectUnauthorized: false,
    },
  });

let transporter = createTransporter(587, false);

const initTransporter = async () => {
  try {
    await transporter.verify();
    console.log("✅ SMTP connected on port 587");
  } catch (err) {
    console.warn("⚠️ Port 587 failed, trying port 465...", err.message);
    transporter = createTransporter(465, true);
    try {
      await transporter.verify();
      console.log("✅ SMTP connected on port 465");
    } catch (altErr) {
      console.error("❌ Both SMTP configs failed:", altErr.message);
    }
  }
};

initTransporter();

module.exports = { get transporter() { return transporter; } };