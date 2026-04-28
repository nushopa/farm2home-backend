const bcrypt = require("bcrypt");
const Driver = require("../../models/Driver");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports.signInDriver = async (req, res, next) => {
  try {
    const { email, phoneNumber, password } = req.body;

    // Ensure one of the identifiers (email or phoneNumber) is provided
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .send({ message: "Email or Phone Number is required!" });
    }

    if (!password) {
      return res.status(400).send({ message: "Password is required!" });
    }

    // Find the driver by email or phone number
    const driver = await Driver.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, driver.password);
    if (!isPasswordValid) {
      return res.status(401).send({ message: "Invalid credentials!" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: driver._id, email: driver.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).send({
      message: "Login successful!",
      token,
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};
