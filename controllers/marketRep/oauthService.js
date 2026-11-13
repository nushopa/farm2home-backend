const jwt = require("jsonwebtoken");
const Notification = require("../../models/Notification");
const {
  sendWelcomeEmail,
  notifyAdminOnboarded,
} = require("../../lib/util/onboarding");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Fail fast at startup — a missing secret means every token is forgeable
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set.");
}

/**
 * Signs a short-lived JWT for a distributor.
 * Payload carries only the minimum claims needed by downstream middleware.
 */
function generateToken(distributor) {
  const payload = {
    id:       distributor._id,
    email:    distributor.email,
    role:     distributor.role,      // required by role-guard middleware
    provider: distributor.authProvider,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Creates a system notification and broadcasts it via Socket.IO.
 * Errors are thrown so callers can decide how to handle them.
 */
async function createDistributorNotification(io, distributor) {
  const { firstName, lastName } = distributor;
  const fullName = `${firstName} ${lastName}`;

  const onboardingTasks = await Promise.allSettled([
    (async () => {
      const notification = await Notification.create({
        category: "distributor",
        title: "New market rep registered",
        full_name: fullName,
        message: `${fullName} created an account.`,
      });

      io.emit("notification", notification);
    })(),
    sendWelcomeEmail("marketrep", {
      email: distributor.email,
      firstName,
    }),
    notifyAdminOnboarded(io, "marketrep", distributor),
  ]);
  const taskNames = [
    "registration notification",
    "welcome email",
    "admin onboarding notification",
  ];
  onboardingTasks.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Market rep ${taskNames[index]} failed:`, result.reason);
    }
  });
}

module.exports = { generateToken, createDistributorNotification };