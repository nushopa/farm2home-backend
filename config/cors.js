const cors = require("cors");

const allowedOrigins = [
  "https://nushopa.com",
  "https://www.nushopa.com",
  process.env.R_URL,
  process.env.ADMIN_URL,
  process.env.D_URL,
  "http://localhost:5173",
].filter(Boolean);

// Log once at startup so it's visible in Render's deploy logs
console.log("🌐 CORS allowed origins:", allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // No Origin header = same-origin, curl, server-to-server, or the
    // mobile app — never subject to CORS, always allow.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);