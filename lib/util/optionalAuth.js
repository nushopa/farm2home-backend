const jwt = require("jsonwebtoken");

function getOptionalUserId(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId || null;
  } catch {
    // expired/invalid token — treat as anonymous, don't block the request
    return null;
  }
}

module.exports = { getOptionalUserId };