const { Router } = require("express");
const passport    = require("passport");
const multer      = require("multer");
const rateLimit   = require("express-rate-limit"); 

const upload = multer({ storage: multer.memoryStorage() });

// ─── Rate limiters (Bug 8 fix) ────────────────────────────────────────────────
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      5,
  message:  { message: "Too many OTP requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { message: "Too many OTP attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ─── Market controllers ───────────────────────────────────────────────────────
const {
  addMarket,
  getAllMarkets,
  deleteMarket,
  editMarket,
  getMarketById,
} = require("../controllers/marketplace.controller");

// ─── Distributor — Auth controllers ──────────────────────────────────────────
const {
  initialRegistration,   // Step 1
  requestOTP,            // Step 2
  verifyOTP,             // Step 3
  createMarketRepAccount, // Step 4
  completeOAuthProfile,
} = require("../controllers/marketRep/create.controller");

const {
  signIn,
  oauthCallback,
} = require("../controllers/marketRep/login.controller");

// ─── Distributor — CRUD controllers ──────────────────────────────────────────
const {
  getAllDistributors,
  getDistributorById,
} = require("../controllers/marketRep/getDistributors.controller");

const {
  editDistributor,
  updateDistributorReviewStatus,
} = require("../controllers/marketRep/editDistributor.controller");

const {
  deleteDistributor,
} = require("../controllers/marketRep/deleteDistributor.controller");

// ─── Middleware ───────────────────────────────────────────────────────────────
const { authMiddleware } = require("../middleware/authMiddleware");

const MarketplaceRouters = (io) => {
  const MarketplaceRouter = Router();

  // ── Market Routes ────────────────────────────────────────────────────────
  MarketplaceRouter.post("/add-market",          addMarket);
  MarketplaceRouter.get("/market",               getAllMarkets);
  MarketplaceRouter.get("/market/:id",           getMarketById);
  MarketplaceRouter.put("/market",               editMarket);
  MarketplaceRouter.delete("/delete-market/:id", deleteMarket);

  // ── Distributor Email Auth — correct order: 1 → 2 → 3 → 4 ──────────────
  MarketplaceRouter.post(
    "/distributor/initial-registration",        // Step 1: save name + password
    initialRegistration
  );
  MarketplaceRouter.post(
    "/distributor/request-otp",                 // Step 2: send OTP
    otpRequestLimiter,
    requestOTP
  );
  MarketplaceRouter.post(
    "/distributor/verify-otp",                  // Step 3: verify OTP
    otpVerifyLimiter,
    verifyOTP
  );
  MarketplaceRouter.post(
    "/distributor/register",                    // Step 4: create Distributor doc
    upload.single("picture"),
    (req, res, next) => createMarketRepAccount(io, req, res, next)
  );
  MarketplaceRouter.post("/distributor/login", signIn);

  // ── Google OAuth ─────────────────────────────────────────────────────────
  MarketplaceRouter.get(
    "/distributor/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
  );
  MarketplaceRouter.get(
    "/distributor/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
      session: false,
    }),
    oauthCallback
  );

  // ── Facebook OAuth ───────────────────────────────────────────────────────
  MarketplaceRouter.get(
    "/distributor/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"], session: false })
  );
  MarketplaceRouter.get(
    "/distributor/auth/facebook/callback",
    passport.authenticate("facebook", {
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=facebook_failed`,
      session: false,
    }),
    oauthCallback
  );

  // ── Complete OAuth Profile ────────────────────────────────────────────────
  MarketplaceRouter.post(
    "/distributor/auth/complete-profile",
    authMiddleware,
    upload.single("picture"),
    (req, res, next) => completeOAuthProfile(io, req, res, next)
  );

  // ── Distributor CRUD ─────────────────────────────────────────────────────
  MarketplaceRouter.get("/distributors",             authMiddleware, getAllDistributors);
  MarketplaceRouter.get("/distributor/:id",          authMiddleware, getDistributorById);
  MarketplaceRouter.put("/distributor/:id",          authMiddleware, editDistributor);
  MarketplaceRouter.patch("/distributor/:id/review", authMiddleware, updateDistributorReviewStatus);
  MarketplaceRouter.delete("/distributor/:id",       authMiddleware, deleteDistributor);
  

  return MarketplaceRouter;
};

module.exports = MarketplaceRouters;