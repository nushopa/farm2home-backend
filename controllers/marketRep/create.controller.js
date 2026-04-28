const crypto    = require("crypto");
const bcrypt    = require("bcrypt");
const { transporter }                        = require("../../lib/util/transporter");
const PendingMarketRep                       = require("../../models/PendingMarketRep");
const Distributor                            = require("../../models/Distributor");
const { generateToken, createDistributorNotification } = require("../marketRep/oauthService");

const BCRYPT_ROUNDS   = 12;
const OTP_TTL_MS      = 15 * 60 * 1000;   // 15 minutes
const OTP_MAX_ATTEMPTS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a cryptographically secure 6-digit OTP string. */
function generateOTP() {
  // crypto.randomInt upper bound is exclusive, so 900_000 gives [100000, 999999]
  return crypto.randomInt(100_000, 1_000_000).toString();
}

/**
 * Strips sensitive fields from a Distributor document before sending to client.
 * Returns a plain object safe to include in API responses.
 */
function sanitizeDistributor(distributor) {
  const obj = distributor.toObject ? distributor.toObject() : { ...distributor };
  delete obj.password;
  delete obj.proofOfIdentity;
  delete obj.__v;
  return obj;
}

// ─── Step 1: Store name + hashed password ─────────────────────────────────────
async function initialRegistration(req, res, next) {
  try {
    const { email, firstName, lastName, password } = req.body;

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ message: "Email, first name, last name, and password are required." });
    }

    // Reject if a verified Distributor account already exists for this email
    const existingDistributor = await Distributor.findOne({ email }).lean();
    if (existingDistributor) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Upsert: allows retrying step 1 without creating duplicate pending records.
    // The unique index on PendingMarketRep.email enforces the one-record-per-email
    // invariant at the database level, protecting against race conditions.
    await PendingMarketRep.findOneAndUpdate(
      { email },
      {
        email,
        firstName,
        lastName,
        password:    hashedPassword,
        verified:    false,
        otp:         undefined,
        otpExpiry:   undefined,
        otpAttempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ message: "Initial registration stored. Proceed to request an OTP." });
  } catch (error) {
    // MongoDB duplicate-key on the unique index means two concurrent requests
    // raced. Treat it as a harmless idempotent success — the record exists.
    if (error.code === 11000) {
      return res.status(200).json({ message: "Initial registration stored. Proceed to request an OTP." });
    }
    next(error);
  }
}

// ─── Step 2: Generate & email a 6-digit OTP ───────────────────────────────────
async function requestOTP(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const existing = await Distributor.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const pending = await PendingMarketRep.findOne({ email });
    if (!pending) {
      return res.status(400).json({ message: "Please complete initial registration first." });
    }

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_TTL_MS);
    const hashedOtp = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    await PendingMarketRep.updateOne(
      { email },
      {
        otp:         hashedOtp,
        otpExpiry,
        verified:    false,
        otpAttempts: 0,         // reset counter on each fresh OTP
      }
    );

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      email,
      subject: "Your OTP for Market Rep Registration",
      text:    `Your one-time password is: ${otp}\n\nIt expires in 15 minutes. Do not share it with anyone.`,
      html:    `<p>Your one-time password is: <strong>${otp}</strong></p><p>It expires in 15 minutes. Do not share it with anyone.</p>`,
    });

    return res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    next(error);
  }
}

// ─── Step 3: Verify OTP ────────────────────────────────────────────────────────
async function verifyOTP(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const record = await PendingMarketRep.findOne({ email });
    if (!record) {
      return res.status(400).json({ message: "No pending registration found." });
    }

    if (!record.otp || !record.otpExpiry) {
      return res.status(400).json({ message: "No OTP has been requested. Please request one first." });
    }

    // Check expiry before consuming an attempt
    if (Date.now() > record.otpExpiry) {
      await PendingMarketRep.updateOne(
        { email },
        { $unset: { otp: "", otpExpiry: "" }, otpAttempts: 0 }
      );
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Brute-force guard
    if (record.otpAttempts >= OTP_MAX_ATTEMPTS) {
      await PendingMarketRep.updateOne(
        { email },
        { $unset: { otp: "", otpExpiry: "" }, otpAttempts: 0 }
      );
      return res.status(429).json({
        message: "Too many incorrect attempts. OTP invalidated — please request a new one.",
      });
    }

    const isValid = await bcrypt.compare(otp, record.otp);

    if (!isValid) {
      await PendingMarketRep.updateOne(
        { email },
        { $inc: { otpAttempts: 1 } }
      );
      const remaining = OTP_MAX_ATTEMPTS - (record.otpAttempts + 1);
      return res.status(400).json({
        message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }

    // Consume the OTP so it cannot be reused
    await PendingMarketRep.updateOne(
      { email },
      { verified: true, $unset: { otp: "", otpExpiry: "" }, otpAttempts: 0 }
    );

    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    next(error);
  }
}

// ─── Step 4: Complete profile and create Distributor account ──────────────────
async function createMarketRepAccount(io, req, res, next) {
  try {
    const { email, phoneNumber, dateOfBirth, address, workCity, proofOfIdentity } = req.body;

    if (!email || !phoneNumber || !dateOfBirth || !address || !workCity || !proofOfIdentity) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    const record = await PendingMarketRep.findOne({ email });
    if (!record) {
      return res.status(400).json({ message: "No pending registration found." });
    }
    if (!record.verified) {
      return res.status(400).json({ message: "Email OTP not verified." });
    }
    if (!record.firstName || !record.lastName || !record.password) {
      return res.status(400).json({ message: "Initial registration incomplete. Please restart." });
    }

    // Re-check email uniqueness at creation time (guard against concurrent sign-ups)
    const emailExists = await Distributor.findOne({ email }).lean();
    if (emailExists) {
      await PendingMarketRep.deleteOne({ email });
      return res.status(409).json({ message: "Email is already registered." });
    }

    const phoneExists = await Distributor.findOne({ phoneNumber }).lean();
    if (phoneExists) {
      return res.status(409).json({ message: "Phone number already registered." });
    }

    // Validate and store profile picture as a URL, not raw base64.
    // If your upload middleware (e.g. multer-s3) puts a location URL on req.file,
    // use that. The fallback handles a local buffer upload for development.
    let profilePicture = "";
    if (req.file) {
      profilePicture = req.file.location   // multer-s3 / Cloudinary URL
        ?? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    const newDistributor = await Distributor.create({
      firstName:         record.firstName,
      lastName:          record.lastName,
      email,
      password:          record.password,   // already hashed in step 1
      phoneNumber,
      dateOfBirth,
      address,
      city:              workCity,
      proofOfIdentity,
      profilePicture,
      authProvider:      "email",
      isProfileComplete: true,
    });

    // Clean up the temporary pending record
    await PendingMarketRep.deleteOne({ email });

    await createDistributorNotification(io, newDistributor);

    const token = generateToken(newDistributor);

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      data:    sanitizeDistributor(newDistributor),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email or phone number already registered." });
    }
    next(error);
  }
}

// ─── OAuth profile completion ──────────────────────────────────────────────────
async function completeOAuthProfile(io, req, res, next) {
  try {
    const distributorId = req.user.id;
    const { phoneNumber, dateOfBirth, address, workCity, proofOfIdentity } = req.body;

    if (!phoneNumber || !dateOfBirth || !address || !workCity || !proofOfIdentity) {
      return res.status(400).json({ message: "All profile fields are required." });
    }

    const phoneExists = await Distributor.findOne({
      phoneNumber,
      _id: { $ne: distributorId },
    }).lean();

    if (phoneExists) {
      return res.status(409).json({ message: "Phone number already registered." });
    }

    let profilePicture;
    if (req.file) {
      profilePicture = req.file.location
        ?? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    const updatePayload = {
      phoneNumber,
      dateOfBirth,
      address,
      city:              workCity,
      proofOfIdentity,
      isProfileComplete: true,
      ...(profilePicture !== undefined && { profilePicture }),
    };

    const distributor = await Distributor.findByIdAndUpdate(
      distributorId,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found." });
    }

    await createDistributorNotification(io, distributor);

    const token = generateToken(distributor);

    return res.status(200).json({
      message: "Profile completed successfully.",
      token,
      data:    sanitizeDistributor(distributor),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Phone number already registered." });
    }
    next(error);
  }
}

module.exports = {
  initialRegistration,
  requestOTP,
  verifyOTP,
  createMarketRepAccount,
  completeOAuthProfile,
};