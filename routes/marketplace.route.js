const { Router } = require("express");
const passport    = require("passport");
const multer      = require("multer");
const rateLimit   = require("express-rate-limit");

const upload = multer({ storage: multer.memoryStorage() });

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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

const {
  addMarket,
  getAllMarkets,
  deleteMarket,
  editMarket,
  getMarketById,
} = require("../controllers/marketplace.controller");

const {
  initialRegistration,
  requestOTP,
  verifyOTP,
  createMarketRepAccount,
  completeOAuthProfile,
} = require("../controllers/marketRep/create.controller");

const {
  signIn,
  oauthCallback,
} = require("../controllers/marketRep/login.controller");

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

const { authMiddleware } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Markets
 *     description: Physical market/location management
 *   - name: MarketRep Auth
 *     description: Distributor (market rep) 4-step registration + OAuth
 *   - name: MarketRep CRUD
 *     description: Distributor account management
 */

const MarketplaceRouters = (io) => {
  const MarketplaceRouter = Router();

  /**
   * @swagger
   * /marketplace/add-market:
   *   post:
   *     summary: Add a market
   *     tags: [Markets]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, city]
   *             properties:
   *               name: { type: string }
   *               city: { type: string }
   *     responses:
   *       201:
   *         description: Market created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Market' }
   *       400: { description: Market already exists in this city }
   */
  MarketplaceRouter.post("/add-market", addMarket);

  /**
   * @swagger
   * /marketplace/market:
   *   get:
   *     summary: List all markets (paginated, staff only)
   *     tags: [Markets]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated market list }
   *       401: { description: Not authorized }
   *   put:
   *     summary: Edit a market
   *     tags: [Markets]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id]
   *             properties:
   *               id: { type: string }
   *     responses:
   *       200:
   *         description: Market updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Market' }
   *       404: { description: Market not found }
   */
  MarketplaceRouter.get("/market", getAllMarkets);
  MarketplaceRouter.put("/market", editMarket);

  /**
   * @swagger
   * /marketplace/market/{id}:
   *   get:
   *     summary: Get a single market by ID
   *     tags: [Markets]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Market found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Market' }
   *       404: { description: Market not found }
   */
  MarketplaceRouter.get("/market/:id", getMarketById);

  /**
   * @swagger
   * /marketplace/delete-market/{id}:
   *   delete:
   *     summary: Delete a market
   *     tags: [Markets]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Market deleted successfully }
   *       404: { description: Market not found }
   */
  MarketplaceRouter.delete("/delete-market/:id", deleteMarket);

  /**
   * @swagger
   * /marketplace/distributor/initial-registration:
   *   post:
   *     summary: "Distributor registration — Step 1: name + password"
   *     tags: [MarketRep Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200: { description: Initial registration saved }
   */
  MarketplaceRouter.post("/distributor/initial-registration", initialRegistration);

  /**
   * @swagger
   * /marketplace/distributor/request-otp:
   *   post:
   *     summary: "Distributor registration — Step 2: send OTP (rate limited: 5 / 15 min)"
   *     tags: [MarketRep Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email: { type: string }
   *     responses:
   *       200: { description: OTP sent }
   *       429: { description: Too many OTP requests }
   */
  MarketplaceRouter.post("/distributor/request-otp", otpRequestLimiter, requestOTP);

  /**
   * @swagger
   * /marketplace/distributor/verify-otp:
   *   post:
   *     summary: "Distributor registration — Step 3: verify OTP (rate limited: 10 / 15 min)"
   *     tags: [MarketRep Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email: { type: string }
   *               otp: { type: string }
   *     responses:
   *       200: { description: OTP verified }
   *       429: { description: Too many OTP attempts }
   */
  MarketplaceRouter.post("/distributor/verify-otp", otpVerifyLimiter, verifyOTP);

  /**
   * @swagger
   * /marketplace/distributor/register:
   *   post:
   *     summary: "Distributor registration — Step 4: create the account"
   *     tags: [MarketRep Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               picture: { type: string, format: binary }
   *     responses:
   *       201: { description: Distributor account created }
   */
  MarketplaceRouter.post(
    "/distributor/register",
    upload.single("picture"),
    (req, res, next) => createMarketRepAccount(io, req, res, next)
  );

  /**
   * @swagger
   * /marketplace/distributor/login:
   *   post:
   *     summary: Distributor login
   *     tags: [MarketRep Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string }
   *               password: { type: string }
   *     responses:
   *       200: { description: Logged in }
   *       401: { description: Invalid credentials }
   */
  MarketplaceRouter.post("/distributor/login", signIn);

  /**
   * @swagger
   * /marketplace/distributor/auth/google:
   *   get:
   *     summary: Start Google OAuth for a distributor
   *     tags: [MarketRep Auth]
   *     responses:
   *       302: { description: Redirects to Google }
   * /marketplace/distributor/auth/google/callback:
   *   get:
   *     summary: Google OAuth callback for a distributor
   *     tags: [MarketRep Auth]
   *     responses:
   *       302: { description: Redirects back with a token or error }
   */
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

  /**
   * @swagger
   * /marketplace/distributor/auth/facebook:
   *   get:
   *     summary: Start Facebook OAuth for a distributor
   *     tags: [MarketRep Auth]
   *     responses:
   *       302: { description: Redirects to Facebook }
   * /marketplace/distributor/auth/facebook/callback:
   *   get:
   *     summary: Facebook OAuth callback for a distributor
   *     tags: [MarketRep Auth]
   *     responses:
   *       302: { description: Redirects back with a token or error }
   */
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

  /**
   * @swagger
   * /marketplace/distributor/auth/complete-profile:
   *   post:
   *     summary: Complete a distributor's profile after OAuth sign-up
   *     tags: [MarketRep Auth]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               picture: { type: string, format: binary }
   *     responses:
   *       200: { description: Profile completed }
   *       401: { description: Unauthorized }
   */
  MarketplaceRouter.post(
    "/distributor/auth/complete-profile",
    authMiddleware,
    upload.single("picture"),
    (req, res, next) => completeOAuthProfile(io, req, res, next)
  );

  /**
   * @swagger
   * /marketplace/distributors:
   *   get:
   *     summary: List all distributors
   *     tags: [MarketRep CRUD]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Distributor list }
   *       401: { description: Unauthorized }
   */
  MarketplaceRouter.get("/distributors", authMiddleware, getAllDistributors);

  /**
   * @swagger
   * /marketplace/distributor/{id}:
   *   get:
   *     summary: Get a distributor by ID
   *     tags: [MarketRep CRUD]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Distributor found }
   *       401: { description: Unauthorized }
   *       404: { description: Not found }
   *   put:
   *     summary: Edit a distributor
   *     tags: [MarketRep CRUD]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Distributor updated }
   *       401: { description: Unauthorized }
   *   delete:
   *     summary: Delete a distributor
   *     tags: [MarketRep CRUD]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Distributor deleted }
   *       401: { description: Unauthorized }
   */
  MarketplaceRouter.get("/distributor/:id", authMiddleware, getDistributorById);
  MarketplaceRouter.put("/distributor/:id", authMiddleware, editDistributor);
  MarketplaceRouter.delete("/distributor/:id", authMiddleware, deleteDistributor);

  /**
   * @swagger
   * /marketplace/distributor/{id}/review:
   *   patch:
   *     summary: Update a distributor's review status
   *     tags: [MarketRep CRUD]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               review: { type: boolean }
   *     responses:
   *       200: { description: Review status updated }
   *       401: { description: Unauthorized }
   */
  MarketplaceRouter.patch("/distributor/:id/review", authMiddleware, updateDistributorReviewStatus);

  return MarketplaceRouter;
};

module.exports = MarketplaceRouters;