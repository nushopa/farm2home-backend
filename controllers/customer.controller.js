const Customer = require("../models/Customer");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const Forget = require("../models/Forget");
const { sendEmail } = require("../lib/util/sendEmail");
const { authMiddleware } = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");
const TempUser = require("../models/tempUser");
const BlacklistedToken = require("../models/BlacklistedToken");
const { Resend } = require("resend");
const passport = require("../config/passport");
const crypto = require("crypto");
const resend = new Resend(process.env.RESEND_API_KEY);


const TOKEN_COOKIE_NAME = "token";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_TTL_JWT = "24h";
const AUTH_HEADER_PREFIX = "Bearer ";

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: TOKEN_TTL_MS,
  path: "/",
});

const resolvePlatform = (req) => {
  const p =
    req.body?.platform ||
    req.query?.platform ||
    req.headers["x-client-platform"];
  return p === "mobile" ? "mobile" : "web";
};

const signToken = ({ userId, role }) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_JWT,
  });


const issueAuth = (req, res, { userId, role }) => {
  const platform = resolvePlatform(req);
  const token = signToken({ userId, role });

  if (platform === "mobile") {
    return { platform, token };
  }

  res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions());
  return { platform, token: undefined };
};

const clearTokenCookie = (res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
};


const getRequestToken = (req) => {
  if (req.cookies?.[TOKEN_COOKIE_NAME]) return req.cookies[TOKEN_COOKIE_NAME];
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return authHeader.slice(AUTH_HEADER_PREFIX.length);
  }
  return null;
};


const killSession = async (req, res) => {
  const token = getRequestToken(req);
  if (token) {
    await BlacklistedToken.create({ token });
  }
  clearTokenCookie(res); // harmless no-op for mobile clients that never had one
  return token;
};

module.exports.createAccount = async (io, req, res, next) => {
  try {
    const { first_name, last_name, phone_number, email, password, role } =
      req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).send({ message: "Credentials are required!" });
    }

    const check = await Customer.findOne({ email });
    if (check) {
      return res
        .status(401)
        .send({ message: "Account with this email already exists" });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const hashPassword = await bcrypt.hash(password, 13);

    const tempUserData = {
      first_name,
      last_name,
      phone_number,
      email,
      password: hashPassword,
      role,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    };

    await TempUser.deleteOne({ email });
    await TempUser.create(tempUserData);

    let subject = "Verify Your Email - Nushopa";
    let emailFileName = "otpVerificationTemp";
    const dataDetails = {
      first_name,
      last_name,
      email,
      otp,
    };
    const recieverEmail = email;
    await sendEmail(recieverEmail, dataDetails, subject, emailFileName);

    res.status(200).send({
      message: "OTP sent to your email. Please verify to complete registration.",
      email: email
    });
  } catch (error) {
    next(error);
  }
};

module.exports.verifyOTPAndCreateAccount = async (io, req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).send({ message: "Email and OTP are required!" });
    }

    const tempUserRecord = await TempUser.findOne({ email });
    if (!tempUserRecord) {
      return res.status(400).send({ message: "Invalid request or OTP expired" });
    }

    if (tempUserRecord.otpExpires < new Date()) {
      await TempUser.deleteOne({ email });
      return res.status(400).send({ message: "OTP has expired. Please register again." });
    }

    if (tempUserRecord.otp !== otp) {
      return res.status(400).send({ message: "Invalid OTP" });
    }

    const data = await Customer.create({
      first_name: tempUserRecord.first_name,
      last_name: tempUserRecord.last_name,
      phone_number: tempUserRecord.phone_number,
      email: tempUserRecord.email,
      password: tempUserRecord.password,
      role: tempUserRecord.role,
    });

    await TempUser.deleteOne({ email });

    let subject = "Welcome to Nushopa";
    let emailFileName = "newUserEmailTemp";
    const dataDetails = {
      first_name: tempUserRecord.first_name,
      last_name: tempUserRecord.last_name,
      email: tempUserRecord.email,
    };
    const recieverEmail = email;
    await sendEmail(recieverEmail, dataDetails, subject, emailFileName);

    await Notification.create({
      title: "A new account has been created",
      full_name: `${tempUserRecord.first_name.trim()} ${tempUserRecord.last_name.trim()}`,
      category: "account-creation",
    });

    const notifications = await Notification.find();
    io.emit("notification", notifications);

    // Web: httpOnly cookie only. Mobile: token returned in the body.
    const { platform, token } = issueAuth(req, res, {
      userId: data._id,
      role: data.role,
    });

    const responseBody = {
      message: "Account created successfully!",
      data,
    };
    if (platform === "mobile") responseBody.token = token;

    res.status(201).send(responseBody);
  } catch (error) {
    next(error);
  }
};

module.exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ message: "Email is required!" });
    }

    const tempUserRecord = await TempUser.findOne({ email });
    if (!tempUserRecord) {
      return res.status(400).send({ message: "No pending registration found for this email" });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    tempUserRecord.otp = otp;
    tempUserRecord.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await tempUserRecord.save();

    let subject = "Verify Your Email - Nushopa";
    let emailFileName = "otpVerificationTemp";
    const dataDetails = {
      first_name: tempUserRecord.first_name,
      last_name: tempUserRecord.last_name,
      email: tempUserRecord.email,
      otp,
    };
    const recieverEmail = email;
    await sendEmail(recieverEmail, dataDetails, subject, emailFileName);

    res.status(200).send({
      message: "New OTP sent to your email.",
      email: email
    });
  } catch (error) {
    next(error);
  }
};

module.exports.loginUser = async (req, res, next) => {
  try {
    const { email, password: pass } = req.body;

    if (!email || !pass)
      return res.status(400).send({ message: "Email or Password is required" });

    const userCheck = await Customer.findOne({ email });
    if (userCheck) {
      const verifyPassword = await bcrypt.compare(pass, userCheck.password);
      if (verifyPassword) {
        // Web: httpOnly cookie only. Mobile: token returned in the body.
        const { platform, token } = issueAuth(req, res, {
          userId: userCheck._id,
          role: userCheck.role,
        });
        const { password, createdAt, updatedAt, ...others } = userCheck._doc;
        const responseBody = { user: others };
        if (platform === "mobile") responseBody.token = token;
        return res.status(200).send(responseBody);
      } else {
        return res.status(401).send({ message: "Invalid Email or password" });
      }
    } else {
      return res.status(401).send({ message: "Invalid Email or password" });
    }
  } catch (error) {
    next(error);
  }
};

module.exports.getAllCustomers = async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  try {
    authMiddleware(req, res, async () => {
      const role = req.role;
      if (role === 2001)
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      const customers = await Customer.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Customer.countDocuments();

      return res.status(200).send({
        customers,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getSingleCustomer = async (req, res, next) => {
  try {
    let { id } = req.params;
    const customer = await Customer.findById(id);
    return res.status(200).send({ customer });
  } catch (error) {
    next(error);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const { id } = req.body;
    const customer = await Customer.findById(id);

    if (customer) {
      customer.first_name = req.body.fname;
      customer.last_name = req.body.lname;

      const saved = await customer.save();

      if (saved) {
        const { password, createdAt, updatedAt, ...others } = customer._doc;
        return res.status(200).send(others);
      } else {
        return res
          .status(400)
          .send({ message: "An error occured please try again later" });
      }
    } else {
      return res.status(404).send({ message: "Customer not found!" });
    }
  } catch (error) {
    next(error);
  }
};

const isMarketRepProfileComplete = (marketRep) => {
  return !!(
    marketRep.city &&
    marketRep.address &&
    marketRep.state &&
    marketRep.id_type &&
    marketRep.date_of_birth &&
    marketRep.proof_Of_Identity
  );
};

module.exports.updateMarketRepProfile = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { userId } = req;

      if (!userId) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const marketRep = await Customer.findById(userId);
      console.log("Decoded userId:", userId, "Found:", !!marketRep);
      if (!marketRep) {
        return res.status(404).send({ message: "Market representative not found!" });
      }

      if (marketRep.role !== 6000) {
        return res.status(403).send({
          message: "This is only for Market Representatives"
        });
      }

      const {  city,
        address,
        date_of_birth,
        state,
        id_type,
        profile_picture,
        proof_of_identity, } = req.body;

      if (city !== undefined) marketRep.city = city?.trim() || null;
      if (address !== undefined) marketRep.address = address?.trim() || null;
      if (date_of_birth !== undefined) marketRep.date_of_birth = date_of_birth || null;
      if (state !== undefined) marketRep.state = state?.trim() || null;
      if (id_type !== undefined) marketRep.id_type = id_type?.trim() || null;
      if (profile_picture !== undefined) marketRep.profile_picture = profile_picture || null;
      if (proof_of_identity !== undefined) marketRep.proof_Of_Identity = proof_of_identity || null;
 
      if (!marketRep.status || marketRep.status === "rejected") {
        marketRep.status = "pending";
      }

      marketRep.profile_completed = isMarketRepProfileComplete(marketRep);

      await marketRep.save();

      const { password, ...profileData } = marketRep.toObject();

      return res.status(200).send({
        success: true,
        message: "Profile updated successfully",
        profile: profileData
      });
    });
  } catch (error) {
    console.error("Update Market Rep Profile Error:", error);
    next(error);
  }
};

module.exports.updateDistributorStatus = async (io, req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const role = req.role;

      if (role === 2001) {
        return res.status(401).send({
          message: "You are not authorized to access this route",
        });
      }

      const { id } = req.params;
      const { status, reason } = req.body;

      const allowedStatuses = ["approved", "rejected", "pending"];
      if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).send({
          message: `Status must be one of: ${allowedStatuses.join(", ")}`,
        });
      }

      const distributor = await Customer.findOne({ _id: id, role: 6000 });

      if (!distributor) {
        return res.status(404).send({ message: "Distributor not found!" });
      }

      // Guard: don't allow approving an incomplete profile
      if (status === "approved" && !distributor.profile_completed) {
        return res.status(400).send({
          message: "Cannot approve a distributor with an incomplete profile.",
        });
      }

      distributor.status = status;
      await distributor.save();

      const { password, ...profileData } = distributor.toObject();

      // --- Email notification ---
      try {
        const isApproved = status === "approved";
        const subject = isApproved
          ? "Your Nushopa Distributor Account Has Been Approved"
          : "Update on Your Nushopa Distributor Application";
        const emailFileName = isApproved
          ? "distributorApprovedTemp"
          : "distributorRejectedTemp";

        const dataDetails = {
          first_name: distributor.first_name,
          last_name: distributor.last_name,
          email: distributor.email,
          reason: reason || null, // optional rejection reason
        };

        await sendEmail(distributor.email, dataDetails, subject, emailFileName);
      } catch (emailErr) {
        console.error("Failed to send status-update email:", emailErr);
      }

      // --- In-app notification ---
      try {
        await Notification.create({
          title:
            status === "approved"
              ? "Distributor account approved"
              : "Distributor account rejected",
          full_name: `${distributor.first_name.trim()} ${distributor.last_name.trim()}`,
          category: "distributor-status-update",
        });

        const notifications = await Notification.find();
        io.emit("notification", notifications);
      } catch (notifErr) {
        console.error("Failed to create/broadcast notification:", notifErr);
      }

      return res.status(200).send({
        success: true,
        message: `Distributor ${status} successfully`,
        distributor: profileData,
      });
    });
  } catch (error) {
    console.error("Update Distributor Status Error:", error);
    next(error);
  }
};

// Admin-only: delete ANY customer by id.
module.exports.deleteCustomer = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const role = req.role;
      if (role === 2001)
        return res
          .status(401)
          .send({ message: "You are not authorized to access this route" });
      const { id } = req.params;

      const customer = await Customer.findById(id);
      if (!customer) {
        return res.status(404).send({ message: "Customer not found!" });
      }

      await Customer.findByIdAndDelete(id);
      return res.status(200).send({ message: "Customer deleted successfully" });
    });
  } catch (error) {
    next(error);
  }
};


module.exports.deleteOwnProfile = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { userId } = req;

      if (!userId) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const customer = await Customer.findById(userId);
      if (!customer) {
        return res.status(404).send({ message: "Customer not found!" });
      }

      await Customer.findByIdAndDelete(userId);

      // Kill the session immediately: blacklist the current token and
      // clear the cookie so it can't be reused after the account is gone.
      await killSession(req, res);

      return res.status(200).send({
        success: true,
        message: "Your account has been deleted successfully",
      });
    });
  } catch (error) {
    next(error);
  }
};

module.exports.forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).send({ message: "All Fields Are Required!" });

    const exitMail = await Customer.findOne({ email });
    if (!exitMail)
      return res.status(404).send({
        message: "Email Not Found, Please Verify Your Email And Try Again",
      });

    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    const existingForget = await Forget.findOne({ user_id: exitMail._id });
    if (existingForget) {
      await Forget.deleteOne({ user_id: exitMail._id });
    }

    const forgetInstance = new Forget({
      user_id: exitMail._id,
      otp: otp,
    });

    await forgetInstance.save();
    
    let subject = "Your Nushopa Password Reset Code";
    let emailFileName = "forgotPasswordTemp";
    const dataDetails = {
      first_name: exitMail.first_name,
      email: exitMail.email,
      otp,
    };

    await sendEmail(exitMail.email, dataDetails, subject, emailFileName);

    return res.status(200).send({ success: true, message: "Reset code sent to your email." });
  } catch (error) {
    console.error("forgetPassword error:", error);
    next(error);
  }
};

module.exports.verifyCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code)
      return res.status(422).send({ message: "All Fields Are Required!" });

    const user = await Customer.findOne({ email });
    if (!user)
      return res
        .status(404)
        .send({ message: "No account Found with this email!" });

    const value = await Forget.findOne({ user_id: user._id });

    if (value.otp === code) {
      await Forget.deleteMany({ user_id: user._id });
      return res.status(200).send(true);
    } else {
      return res.status(400).send({ message: "Invalid code!" });
    }
  } catch (error) {
    next(error);
  }
};

module.exports.updateUserPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(422).send({ message: "All Fields Are Required!" });

    const user = await Customer.findOne({ email });
    if (!user)
      return res
        .status(404)
        .send({ message: "No account Found with this emaill!" });

    const hashPassword = await bcrypt.hash(password, 13);

    user.password = hashPassword;
    const saved = await user.save();

    if (saved) {
      return res.status(200).send(true);
    } else {
      return res
        .status(400)
        .send({ message: "Unable to update your password." });
    }
  } catch (error) {
    next(error);
  }
};

module.exports.getCustomerCountByMonth = async (req, res, next) => {
  try {
    const customers = await Customer.find();
    const customerCountByMonth = {};

    customers.forEach((customer) => {
      const date = new Date(customer.createdAt);
      const month = date.toLocaleString("default", { month: "short" });

      if (!customerCountByMonth[month]) {
        customerCountByMonth[month] = 1;
      } else {
        customerCountByMonth[month]++;
      }
    });

    res.status(200).json({ customerCountByMonth });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error calculating total customers by month" });
  }
};

module.exports.getAllDistributors = async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  try {
    authMiddleware(req, res, async () => {
      const role = req.role;
      if (role === 2001) {
        return res.status(401).send({
          message: "You are not authorized to access this route"
        });
      }

      const distributors = await Customer.find({ role: 6000 })
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalDistributors = await Customer.countDocuments({ role: 6000 });

      return res.status(200).send({
        distributors,
        totalDistributors,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDistributors / parseInt(limit)),
      });
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getSingleDistributor = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { id } = req.params;
      const distributor = await Customer.findOne({
        _id: id,
        role: 6000
      }).select('-password').lean();

      if (!distributor) {
        return res.status(404).send({ message: "Distributor not found!" });
      }

      return res.status(200).send({ distributor });
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getProfileDetails = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { userId } = req;

      if (!userId) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const customer = await Customer.findById(userId).select('-password').lean();

      if (!customer) {
        return res.status(404).send({ message: "Customer not found!" });
      }

      return res.status(200).send({
        success: true,
        message: "Profile details retrieved successfully",
        customer
      });

    });
  } catch (error) {
    next(error);
  }
};

module.exports.logoutUser = async (req, res, next) => {
  try {
    
    const token = getRequestToken(req);

    if (!token) {
      return res.status(401).json({ message: "No active session" });
    }

    await killSession(req, res);

    return res.status(200).json({
      message: "Logged out successfully",
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.googleAuth = (req, res, next) => {
  const platform = req.query.platform === "mobile" ? "mobile" : "web";
  const csrfToken = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ csrfToken, platform })).toString("base64url");

  res.cookie("google_oauth_state", csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",           // fixes the earlier path-mismatch so clearCookie actually works
    maxAge: 5 * 60 * 1000,
  });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
  })(req, res, next);
};

module.exports.googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err, customer) => {
    try {
      const returnedStateRaw = req.query.state;
      const savedCsrfToken = req.cookies?.google_oauth_state;
      res.clearCookie("google_oauth_state", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      let platform = "web";
      let returnedCsrfToken;

      try {
        const decoded = JSON.parse(Buffer.from(returnedStateRaw, "base64url").toString());
        platform = decoded.platform === "mobile" ? "mobile" : "web";
        returnedCsrfToken = decoded.csrfToken;
      } catch {
        // malformed state — treat as invalid below
      }

      const isValidState = returnedCsrfToken && savedCsrfToken && returnedCsrfToken === savedCsrfToken;

      const redirectWithError = (message) => {
        const encoded = encodeURIComponent(message);
        if (platform === "mobile") {
          return res.redirect(`${process.env.APP_SCHEME}://auth-callback?error=${encoded}`);
        }
        return res.redirect(`${process.env.F_URL}/auth/callback?error=${encoded}`);
      };

      if (!isValidState) return redirectWithError("invalid_state");
      if (err || !customer) return redirectWithError("google_auth_failed");

      if (platform === "mobile") {
        const mobileToken = signToken({ userId: customer._id, role: customer.role });
        return res.redirect(`${process.env.APP_SCHEME}://auth-callback?token=${mobileToken}`);
      }

      res.cookie(TOKEN_COOKIE_NAME, signToken({ userId: customer._id, role: customer.role }), cookieOptions());
      return res.redirect(`${process.env.F_URL}/auth/callback`);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};