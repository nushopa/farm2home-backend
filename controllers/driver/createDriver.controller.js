const bcrypt = require("bcrypt");
const Driver = require("../../models/Driver");
const PendingDriver = require("../../models/PendingDriver");
const nodemailer = require("nodemailer");
const Notification = require("../../models/Notification");
const jwt = require("jsonwebtoken");
const { transporter } = require("../../lib/util/transporter");

const JWT_SECRET = process.env.JWT_SECRET;

async function requestOTP(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email is already registered
    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Generate OTP and set expiry
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiry

    // Store in PendingDriver collection
    await PendingDriver.findOneAndUpdate(
      { email },
      { email, otp, otpExpiry, verified: false },
      { upsert: true, new: true }
    );

    // Send OTP via email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your OTP for Driver Registration",
      text: `Your OTP is: ${otp}. It will expire in 15 minutes.`,
    };
    await transporter.sendMail(mailOptions);

    return res
      .status(200)
      .json({ message: "OTP has been sent to your email." });
  } catch (error) {
    next(error);
  }
}

/**
 * Step 2: Verify OTP
 */
async function verifyOTP(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const registration = await PendingDriver.findOne({ email });

    if (!registration) {
      return res
        .status(400)
        .json({ message: "No pending registration found." });
    }

    if (Date.now() > registration.otpExpiry) {
      await PendingDriver.deleteOne({ email });
      return res.status(400).json({ message: "OTP has expired." });
    }

    if (registration.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP provided." });
    }

    await PendingDriver.updateOne({ email }, { verified: true });

    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    next(error);
  }
}

/**
 * Step 3: Select Vehicle Type
 */
async function selectVehicleType(req, res, next) {
  try {
    const { email, vehicleType } = req.body;
    if (!email || !vehicleType) {
      return res
        .status(400)
        .json({ message: "Email and vehicle type are required." });
    }

    const registration = await PendingDriver.findOne({ email });

    if (!registration || !registration.verified) {
      return res.status(400).json({ message: "OTP not verified yet." });
    }

    await PendingDriver.updateOne({ email }, { vehicleType });

    return res
      .status(200)
      .json({ message: "Vehicle type recorded successfully." });
  } catch (error) {
    next(error);
  }
}

/**
 * Step 4: Complete Registration
 */
async function createDriverAccount(io, req, res, next) {
  try {
    const {
      email,
      firstName,
      lastName,
      password,
      phoneNumber,
      dateOfBirth,
      address,
      workCity,
      proofOfIdentity,
      licenseFile,
      profilePicture,
    } = req.body;

    if (
      !email ||
      !firstName ||
      !lastName ||
      !password ||
      !phoneNumber ||
      !dateOfBirth ||
      !address ||
      !workCity ||
      !proofOfIdentity ||
      !licenseFile
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const registration = await PendingDriver.findOne({ email });

    if (!registration || !registration.verified) {
      return res.status(400).json({ message: "OTP not verified yet." });
    }

    if (!registration.vehicleType) {
      return res.status(400).json({ message: "Vehicle type is missing." });
    }

    const existingDriver = await Driver.findOne({ phoneNumber });
    if (existingDriver) {
      return res
        .status(400)
        .json({ message: "Phone number is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new driver account
    const newDriver = await Driver.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber,
      dateOfBirth,
      address,
      workCity,
      vehicleType: registration.vehicleType,
      proofOfIdentity,
      licenseFile,
      status: false,
      review: false,
      profilePicture: profilePicture || "",
    });

    // Remove from pending registrations
    await PendingDriver.deleteOne({ email });

    await Notification.create({
      category: "driver",
      title: "A new driver created an account",
      full_name: `${firstName} ${lastName}`,
      message: `${firstName} ${lastName} created an account!`,
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);
    // Generate a JWT token
    const token = jwt.sign(
      { id: newDriver._id, email: newDriver.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      token,
      message: "Driver account created successfully.",
      data: newDriver,
    });
  } catch (error) {
    next(error);
  }
}

//oauth registration

const initialRegistration = async (req, res, next) => {
  try {
    const { email, firstName, lastName, password, profilePicture } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email is already registered
    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: "Email is already registered" });
    }
    const existingDrivers = await PendingDriver.findOne({ email });
    if (existingDrivers) {
      return res.status(400).json({ message: "Registration is pending" });
    }

    const postData = {
      email,
      firstName,
      lastName,
      password,
      profilePicture: profilePicture || "",
      verified: true
    };
    const pendingDriver = await PendingDriver.create(postData);

    return res.status(200).json({
      message: "Initial registration data stored successfully.",
      data: pendingDriver,
    });
  } catch (error) {
    next(error);
  }
};
async function createOauthDriverAccount(io, req, res, next) {
  try {
    const {
      email,
      phoneNumber,
      dateOfBirth,
      address,
      workCity,
      proofOfIdentity,
      licenseFile,
    } = req.body;

    if (
      !email ||
      !phoneNumber ||
      !dateOfBirth ||
      !address ||
      !workCity ||
      !proofOfIdentity ||
      !licenseFile
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const registration = await PendingDriver.findOne({ email });
    if (!registration) {
      return res.status(400).json({ message: "No pending creation" });
    }

    const existingMarketRep = await Driver.findOne({ phoneNumber });
    if (existingMarketRep) {
      return res
        .status(400)
        .json({ message: "Phone number is already registered" });
    }
    if (!registration.vehicleType) {
      return res.status(400).json({ message: "Vehicle type is missing." });
    }
    const hashedPassword = await bcrypt.hash(registration.password, 10);

    // Create new driver account
    const newDriver = await Driver.create({
      firstName: registration.firstName,
      lastName: registration.lastName,
      email,
      password: hashedPassword,
      phoneNumber,
      dateOfBirth,
      address,
      workCity,
      vehicleType: registration.vehicleType,
      proofOfIdentity,
      licenseFile,
      status: false,
      review: false,
      profilePicture: registration.profilePicture || "",
    });

    // Remove from pending registrations
    await PendingDriver.deleteOne({ email });

    await Notification.create({
      category: "driver",
      title: "A new driver created an account",
      full_name: `${newDriver.firstName} ${newDriver.lastName}`,
      message: `${newDriver.firstName} ${newDriver.lastName} created an account!`,
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);
    // Generate a JWT token
    const token = jwt.sign(
      { id: newDriver._id, email: newDriver.email },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      token,
      message: "Driver account created successfully.",
      data: newDriver,
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  requestOTP,
  verifyOTP,
  selectVehicleType,
  createDriverAccount,
  initialRegistration,
  createOauthDriverAccount,
};
