const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Driver = require("../../models/Driver");
const PendingDriver = require("../../models/PendingDriver");
const Notification = require("../../models/Notification");
const { sendResendEmail } = require("../../lib/util/sendResendEmail");
const {
  sendWelcomeEmail,
  notifyAdminOnboarded,
} = require("../../lib/util/onboarding");

const JWT_SECRET = process.env.JWT_SECRET;

const sanitizeDriver = (driver) => {
  const obj =
    typeof driver.toObject === "function" ? driver.toObject() : driver;
  delete obj.password;
  return obj;
};

async function notifyDriverOnboarded(io, driver) {
  const onboardingTasks = await Promise.allSettled([
    sendWelcomeEmail("rider", {
      email: driver.email,
      firstName: driver.firstName,
    }),
    notifyAdminOnboarded(io, "rider", driver),
  ]);
  onboardingTasks.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Rider onboarding notification ${index} failed:`, result.reason);
    }
  });
}

/**
 * Step 1: Request OTP
 */
async function requestOTP(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // 4-digit OTP, 15 minute expiry
    const otp = crypto.randomInt(1000, 10000).toString();
    const otpExpiry = Date.now() + 15 * 60 * 1000;

    await PendingDriver.findOneAndUpdate(
      { email },
      { email, otp, otpExpiry, verified: false },
      { upsert: true, returnDocument: "after" },
    );

    await sendResendEmail({
      to: email,
      subject: "Your OTP for Driver Registration",
      text: `Your OTP is: ${otp}. It will expire in 15 minutes.`,
    });

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
 * Step 4: Complete Registration (email/password flow)
 * `availability` is optional. If omitted, the schema default applies.
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
      availability,
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

    if (availability !== undefined && typeof availability !== "boolean") {
      return res
        .status(400)
        .json({ message: "Availability must be true or false" });
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
      ...(availability !== undefined && { availability }),
    });

    await PendingDriver.deleteOne({ email });

    await Notification.create({
      category: "driver",
      title: "A new driver created an account",
      full_name: `${firstName} ${lastName}`,
      message: `${firstName} ${lastName} created an account!`,
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);
    await notifyDriverOnboarded(io, newDriver);

    const token = jwt.sign(
      { id: newDriver._id, email: newDriver.email },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(201).json({
      token,
      message: "Driver account created successfully.",
      data: sanitizeDriver(newDriver),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * OAuth registration, step 1: store initial data.
 * The password is hashed here so plain text is never stored. If the OAuth
 * user has no password, a random one is generated (the schema requires one).
 */
const initialRegistration = async (req, res, next) => {
  try {
    const { email, firstName, lastName, password, profilePicture } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingDriver = await Driver.findOne({ email });
    if (existingDriver) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const existingPending = await PendingDriver.findOne({ email });
    if (existingPending) {
      return res.status(400).json({ message: "Registration is pending" });
    }

    const rawPassword = password || crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const pendingDriver = await PendingDriver.create({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      profilePicture: profilePicture || "",
      verified: true,
    });

    const { password: _pw, ...safePending } = pendingDriver.toObject();

    return res.status(200).json({
      message: "Initial registration data stored successfully.",
      data: safePending,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * OAuth registration, final step.
 * `availability` is optional.
 */
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
      availability,
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

    if (availability !== undefined && typeof availability !== "boolean") {
      return res
        .status(400)
        .json({ message: "Availability must be true or false" });
    }

    const registration = await PendingDriver.findOne({ email });
    if (!registration) {
      return res.status(400).json({ message: "No pending creation" });
    }

    const existingPhone = await Driver.findOne({ phoneNumber });
    if (existingPhone) {
      return res
        .status(400)
        .json({ message: "Phone number is already registered" });
    }

    if (!registration.vehicleType) {
      return res.status(400).json({ message: "Vehicle type is missing." });
    }

    const newDriver = await Driver.create({
      firstName: registration.firstName,
      lastName: registration.lastName,
      email,
      // Already hashed in initialRegistration
      password: registration.password,
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
      ...(availability !== undefined && { availability }),
    });

    await PendingDriver.deleteOne({ email });

    await Notification.create({
      category: "driver",
      title: "A new driver created an account",
      full_name: `${newDriver.firstName} ${newDriver.lastName}`,
      message: `${newDriver.firstName} ${newDriver.lastName} created an account!`,
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);
    await notifyDriverOnboarded(io, newDriver);

    const token = jwt.sign(
      { id: newDriver._id, email: newDriver.email },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(201).json({
      token,
      message: "Driver account created successfully.",
      data: sanitizeDriver(newDriver),
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
