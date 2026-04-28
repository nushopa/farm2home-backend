const bcrypt = require("bcrypt");
const Distributor    = require("../../models/Distributor");
const { generateToken } = require("../marketRep/oauthService");

/**
 * Strips sensitive fields from a Distributor document before sending to client.
 */
function sanitizeDistributor(distributor) {
  const obj = distributor.toObject ? distributor.toObject() : { ...distributor };
  delete obj.password;
  delete obj.proofOfIdentity;
  delete obj.__v;
  return obj;
}

// ─── Email / phone + password sign-in ─────────────────────────────────────────
async function signIn(req, res, next) {
  try {
    const { email, phoneNumber, password } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ message: "Email or phone number is required." });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    // Use a single query for both lookup fields
    const distributor = await Distributor.findOne(
      { $or: [{ email }, { phoneNumber }] }
    );

    // Use a generic message to avoid leaking whether an account exists
    if (!distributor) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Block OAuth-only accounts from password login
    if (!distributor.password) {
      return res.status(400).json({
        message: `This account uses ${distributor.authProvider} sign-in. Please sign in with ${distributor.authProvider}.`,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, distributor.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = generateToken(distributor);

    return res.status(200).json({
      message: "Login successful.",
      token,
      data:    sanitizeDistributor(distributor),
    });
  } catch (error) {
    next(error);
  }
}

// ─── OAuth callback (Passport sets req.user after successful auth) ─────────────
async function oauthCallback(req, res, next) {
  try {
    const distributor = req.user;

    if (!distributor) {
      return res.status(401).json({ message: "OAuth authentication failed." });
    }

    const token = generateToken(distributor);

    if (!distributor.isProfileComplete) {
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/complete-profile`);
      redirectUrl.searchParams.set("token", token);
      redirectUrl.searchParams.set("provider", distributor.authProvider);
      return res.redirect(redirectUrl.toString());
    }

    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
    redirectUrl.searchParams.set("token", token);
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
}

module.exports = { signIn, oauthCallback };