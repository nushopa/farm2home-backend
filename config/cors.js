// config/cors.js
const cors = require("cors");

const allowedOrigins = [
  process.env.F_URL,
  process.env.R_URL,
  process.env.ADMIN_URL,
  process.env.D_URL,
  "http://localhost:5173",
];

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