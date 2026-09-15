const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../models/BlacklistedToken");
const {
  ACCESS_COOKIE_NAME,
  AUTH_HEADER_PREFIX,
} = require("../constant/authConstants"); // adjust path to wherever you place authConstants.js

const clearStaleCookie = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

const getRequestToken = (req) => {
  if (req.cookies?.[ACCESS_COOKIE_NAME]) return req.cookies[ACCESS_COOKIE_NAME];
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return authHeader.slice(AUTH_HEADER_PREFIX.length);
  }
  return null;
};

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract token — cookie (web) or Bearer header (mobile).
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

    req.userId = decoded.userId;
    req.role = decoded.role; // plain value, e.g. 2001 — never wrap this in an object downstream

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      if (req.cookies?.[ACCESS_COOKIE_NAME]) clearStaleCookie(res);
      return res.status(401).json({ message: "Unauthorized - Token has expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ message: "Forbidden - Invalid token" });
    }
    next(error);
  }
};

module.exports = { authMiddleware };