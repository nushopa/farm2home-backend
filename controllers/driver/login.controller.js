const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Driver = require("../../models/Driver");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports.signInDriver = async (req, res, next) => {
  try {
    const { email, phoneNumber, password } = req.body;

    if (!email && !phoneNumber) {
      return res
        .status(400)
        .send({ message: "Email or Phone Number is required!" });
    }

    if (!password) {
      return res.status(400).send({ message: "Password is required!" });
    }

    // Only include identifiers that were actually sent. Otherwise
    // { phoneNumber: undefined } can match unintended documents.
    const identifiers = [];
    if (email) identifiers.push({ email });
    if (phoneNumber) identifiers.push({ phoneNumber });

    const driver = await Driver.findOne({ $or: identifiers });
    if (!driver) {
      return res.status(404).send({ message: "Driver not found!" });
    }

    const isPasswordValid = await bcrypt.compare(password, driver.password);
    if (!isPasswordValid) {
      return res.status(401).send({ message: "Invalid credentials!" });
    }

    const token = jwt.sign(
      { id: driver._id, email: driver.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const driverData = driver.toObject();
    delete driverData.password;

    res.status(200).send({
      message: "Login successful!",
      token,
      data: driverData,
    });
  } catch (error) {
    next(error);
  }
};