const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../models/BlacklistedToken");
const {
  ACCESS_COOKIE_NAME,
  AUTH_HEADER_PREFIX,
} = require("../constant/authConstants"); // adjust path to wherever you place authConstants.js

const clearStaleCookie = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, {
    httpOnly: true,
    secure: true, /* process.env.NODE_ENV === "production",*/
    sameSite: "none",
    path: "/",
  });
};

const getBearerToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return authHeader.slice(AUTH_HEADER_PREFIX.length);
  }
  return null;
};

// Cookie first, then Authorization header (used by user/admin/rep auth)
const getRequestToken = (req) => {
  if (req.cookies?.[ACCESS_COOKIE_NAME]) return req.cookies[ACCESS_COOKIE_NAME];
  return getBearerToken(req);
};

/**
 * User/admin/rep auth.
 * Payload: { userId, role }. Sets req.userId and req.role.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = getRequestToken(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      if (req.cookies?.[ACCESS_COOKIE_NAME]) clearStaleCookie(res);
      return res.status(401).json({ message: "Unauthorized - Token has been invalidated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Reject tokens of another type (e.g. driver tokens, which carry { id, email })
    if (!decoded?.userId) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    req.userId = decoded.userId;
    req.role = decoded.role;

    next();
  } catch (error) {
    // Any verification failure = force logout, not just expiry.
    if (req.cookies?.[ACCESS_COOKIE_NAME]) clearStaleCookie(res);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized - Token has expired. Please log in again." });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthorized - Invalid token. Please log in again." });
    }
    next(error);
  }
};

/**
 * Driver auth.
 * Payload: { id, email }. Expects Authorization: Bearer <token>. Sets req.driverId.
 */
const driverAuthMiddleware = (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    req.driverId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid or expired token" });
  }
};

module.exports = { authMiddleware, driverAuthMiddleware };