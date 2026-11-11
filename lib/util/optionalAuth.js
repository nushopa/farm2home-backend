const jwt = require("jsonwebtoken");
const { ACCESS_COOKIE_NAME } = require("../../constant/authConstants");
const Customer = require("../../models/Customer");
const Distributor = require("../../models/Distributor");
const Driver = require("../../models/Driver");

function getOptionalToken(req) {
  const cookieToken =
    req.cookies?.[ACCESS_COOKIE_NAME] ||
    req.cookies?.jwt ||
    req.cookies?.authToken;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

async function getOptionalUser(req) {
  const token = getOptionalToken(req);
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  if (decoded.userId) {
    return { userId: decoded.userId, userModel: "Customer" };
  }
  if (!decoded.id) return null;

  const [driver, distributor] = await Promise.all([
    Driver.findById(decoded.id).select("_id").lean(),
    Distributor.findById(decoded.id).select("_id").lean(),
  ]);
  if (driver && distributor) return null;
  if (driver) return { userId: driver._id, userModel: "Drivers" };
  if (distributor) return { userId: distributor._id, userModel: "Distributor" };
  return null;
}

async function getOptionalUserId(req) {
  return (await getOptionalUser(req))?.userId || null;
}

module.exports = { getOptionalUserId, getOptionalUser };