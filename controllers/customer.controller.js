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

    res.status(201).send({
      message: "Account created successfully!",
      data
    });
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
        const token = jwt.sign(
          { userId: userCheck._id, role: userCheck.role },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        const { password, createdAt, updatedAt, ...others } = userCheck._doc;
        return res.status(200).send({ user: others, token });
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
      const { role } = req.role;
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

module.exports.updateMarketRepProfile = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { userId } = req;

      if (!userId) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const marketRep = await Customer.findById(userId);
      if (!marketRep) {
        return res.status(404).send({ message: "Market representative not found!" });
      }

      if (marketRep.role !== 6000) {
        return res.status(403).send({
          message: "This is only for Market Representatives"
        });
      }

      const { city, address, date_of_birth, profile_picture, proof_Of_Identity } = req.body;

      if (city !== undefined) marketRep.city = city?.trim() || null;
      if (address !== undefined) marketRep.address = address?.trim() || null;
      if (date_of_birth !== undefined) marketRep.date_of_birth = date_of_birth || null;
      if (profile_picture !== undefined) marketRep.profile_picture = profile_picture || null;
      if (proof_Of_Identity !== undefined) marketRep.proof_Of_Identity = proof_Of_Identity || null;

      if (!marketRep.status || marketRep.status === "rejected") {
        marketRep.status = "pending";
      }

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

module.exports.deleteCustomer = async (req, res, next) => {
  try {
    authMiddleware(req, res, async () => {
      const { role } = req.role;
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

    const savedOtp = await Forget.findOne({ user_id: exitMail._id });

    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: exitMail.email,
      subject: "Confirmation code ✔",
      text: `Your Nushopa password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, please ignore this email.`,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(400).send({
        message: "An error occurred!"
      });
    }

    return res.status(200).send(true);

  } catch (error) {
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
      const { role } = req.role;
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
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    await BlacklistedToken.create({ token });

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
      res.clearCookie("google_oauth_state");

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
        if (platform === "mobile") {
          return res.redirect(`${process.env.APP_SCHEME}://auth-callback?error=${message}`);
        }
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${message}`);
      };

      if (!isValidState) {
        return redirectWithError("invalid_state");
      }

      if (err || !customer) {
        return redirectWithError("google_auth_failed");
      }

      const token = jwt.sign(
        { userId: customer._id, role: customer.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      if (platform === "mobile") {
        return res.redirect(`${process.env.APP_SCHEME}://auth-callback?token=${token}`);
      }

      // Web: token passed via redirect URL, matching the existing
      // localStorage + Bearer-header pattern used by email/password login.
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};