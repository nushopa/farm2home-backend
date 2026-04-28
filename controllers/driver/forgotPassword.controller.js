const bcrypt = require("bcrypt");
const Driver = require("../../models/Driver");
const jwt = require("jsonwebtoken");
const { transporter } = require("../../lib/util/transporter");


const RESET_PASSWORD_TOKEN_EXPIRY = "15m"; // 15 minutes expiry for the reset token
const JWT_SECRET = process.env.JWT_SECRET;

// Controller to handle forgot password
module.exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if the email exists in the database
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res
        .status(404)
        .send({ message: "Driver with this email does not exist!" });
    }

    // Generate a reset token
    const resetToken = jwt.sign(
      { id: driver._id, email: driver.email },
      JWT_SECRET,
      {
        expiresIn: RESET_PASSWORD_TOKEN_EXPIRY,
      }
    );

    // Create a reset link
    const resetLink = `${process.env.F_URL}/reset-password?token=${resetToken}`;

    // Send the email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      text: `You requested to reset your password. Click the link to reset it: ${resetLink}`,
      html: `<p>You requested to reset your password. Click the link below to reset it:</p>
             <a href="${resetLink}">${resetLink}</a>`,
    });

    res
      .status(200)
      .send({
        message: "Password reset link sent to your email!",
        success: true,
      });
  } catch (error) {
    next(error);
  }
};

// Controller to validate the reset token and change the password
module.exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const driverId = decoded.id;

    // Find the driver by ID
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).send({ message: "Invalid or expired token!" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    driver.password = hashedPassword;
    await driver.save();

    res.status(200).send({ message: "Password reset successful!" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).send({ message: "Reset token has expired!" });
    }
    next(error);
  }
};
