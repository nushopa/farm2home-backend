const { Router } = require("express");
const {
  createAccount,
  loginUser,
  getAllCustomers,
  getAllDistributors,
  getSingleDistributor,
  updateProfile,
  getSingleCustomer,
  deleteCustomer,
  forgetPassword,
  verifyCode,
  updateUserPassword,
  getCustomerCountByMonth,
  resendOTP,
  verifyOTPAndCreateAccount,
  logoutUser,
  getProfileDetails,
  updateMarketRepProfile,
  googleAuth,
  googleCallback,
  updateDistributorStatus,
} = require("../controllers/customer.controller");
const {
  getCustomerCount,
} = require("../controllers/dashboardSummary.controller");
const { authMiddleware } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Customer/distributor registration, login, password recovery
 *   - name: Customers
 *     description: Customer profile and account management
 *   - name: Distributors
 *     description: Distributor (market rep) directory and status management
 */

const CustomerRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /create:
   *   post:
   *     summary: Start registration (sends an OTP to the given email)
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [first_name, last_name, email, password]
   *             properties:
   *               first_name: { type: string }
   *               last_name: { type: string }
   *               phone_number: { type: string }
   *               email: { type: string, format: email }
   *               password: { type: string, format: password }
   *               role: { type: integer }
   *     responses:
   *       200: { description: OTP sent }
   *       400: { description: Missing fields }
   *       401: { description: Account already exists }
   */
  router.post("/create", (req, res, next) => createAccount(io, req, res, next));

  /**
   * @swagger
   * /verify-otp:
   *   post:
   *     summary: Verify OTP and finalize account creation
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, otp]
   *             properties:
   *               email: { type: string, format: email }
   *               otp: { type: string }
   *     responses:
   *       201:
   *         description: Account created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message: { type: string }
   *                 data: { $ref: '#/components/schemas/Customer' }
   *                 token: { type: string }
   *       400: { description: Invalid/expired OTP }
   */
  router.post("/verify-otp", (req, res, next) =>
    verifyOTPAndCreateAccount(io, req, res, next),
  );

  /**
   * @swagger
   * /resend-otp:
   *   post:
   *     summary: Resend the registration OTP
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string, format: email }
   *     responses:
   *       200: { description: New OTP sent }
   *       400: { description: No pending registration found }
   */
  router.post("/resend-otp", resendOTP);

  /**
   * @swagger
   * /login:
   *   post:
   *     summary: Log in with email + password
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string, format: password }
   *     responses:
   *       200:
   *         description: Logged in
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user: { $ref: '#/components/schemas/Customer' }
   *                 token: { type: string }
   *       401: { description: Invalid email or password }
   */
  router.post("/login", loginUser);

  /**
   * @swagger
   * /logout:
   *   post:
   *     summary: Log out (blacklists the bearer token)
   *     tags: [Auth]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Logged out successfully }
   *       401: { description: No token provided }
   */
  router.post("/logout", logoutUser);

  /**
   * @swagger
   * /customers/forget:
   *   post:
   *     summary: Request a password-reset OTP
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string, format: email }
   *     responses:
   *       200: { description: Reset code sent }
   *       404: { description: Email not found }
   */
  router.post("/customers/forget", forgetPassword);

  /**
   * @swagger
   * /customers/verify:
   *   post:
   *     summary: Verify a password-reset OTP
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, code]
   *             properties:
   *               email: { type: string, format: email }
   *               code: { type: string }
   *     responses:
   *       200: { description: Code valid }
   *       400: { description: Invalid code }
   *       404: { description: No account found }
   */
  router.post("/customers/verify", verifyCode);

  /**
   * @swagger
   * /customers/update:
   *   post:
   *     summary: Set a new password after OTP verification
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string, format: password }
   *     responses:
   *       200: { description: Password updated }
   *       404: { description: No account found }
   */
  router.post("/customers/update", updateUserPassword);

  /**
   * @swagger
   * /profile:
   *   get:
   *     summary: Get the authenticated user's profile
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Profile fetched
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 customer: { $ref: '#/components/schemas/Customer' }
   *       401: { description: Unauthorized }
   *       404: { description: Customer not found }
   */
  router.get("/profile", getProfileDetails);

  /**
   * @swagger
   * /update/profile:
   *   put:
   *     summary: Update first/last name for a customer
   *     tags: [Customers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id]
   *             properties:
   *               id: { type: string }
   *               fname: { type: string }
   *               lname: { type: string }
   *     responses:
   *       200: { description: Profile updated }
   *       404: { description: Customer not found }
   */
  router.put("/update/profile", updateProfile);

  /**
   * @swagger
   * /update/market-rep/profile:
   *   put:
   *     summary: Complete/update a market rep (distributor) profile
   *     tags: [Distributors]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               city: { type: string }
   *               address: { type: string }
   *               date_of_birth: { type: string, format: date }
   *               state: { type: string }
   *               id_type: { type: string }
   *               profile_picture: { type: string }
   *               proof_of_identity: { type: string }
   *     responses:
   *       200: { description: Profile updated }
   *       403: { description: Not a market representative }
   *       404: { description: Market representative not found }
   */
  router.put("/update/market-rep/profile", updateMarketRepProfile);

  /**
   * @swagger
   * /customer/customer-per-month:
   *   get:
   *     summary: Count of customers created, grouped by month
   *     tags: [Customers]
   *     responses:
   *       200: { description: Counts by month }
   */
  router.get("/customer/customer-per-month", getCustomerCountByMonth);

  /**
   * @swagger
   * /customers/total:
   *   get:
   *     summary: Total customer count
   *     tags: [Customers]
   *     responses:
   *       200:
   *         description: Total customer count
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalCustomer: { type: integer }
   */
  router.get("/customers/total", getCustomerCount);

  /**
   * @swagger
   * /customers/distributors:
   *   get:
   *     summary: List all distributors (paginated)
   *     tags: [Distributors]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200:
   *         description: Paginated distributor list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 distributors:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Customer' }
   *                 totalDistributors: { type: integer }
   *                 currentPage: { type: integer }
   *                 totalPages: { type: integer }
   *       401: { description: Not authorized }
   */
  router.get("/customers/distributors", getAllDistributors);

  /**
   * @swagger
   * /customers/distributors/{id}:
   *   get:
   *     summary: Get a single distributor by ID
   *     tags: [Distributors]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Distributor found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 distributor: { $ref: '#/components/schemas/Customer' }
   *       404: { description: Distributor not found }
   */
  router.get("/customers/distributors/:id", getSingleDistributor);

  /**
   * @swagger
   * /customers/distributors/{id}/status:
   *   patch:
   *     summary: Approve, reject, or set a distributor's status to pending
   *     tags: [Distributors]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [approved, rejected, pending] }
   *               reason: { type: string, description: Optional rejection reason }
   *     responses:
   *       200: { description: Status updated }
   *       400: { description: Invalid status, or profile incomplete for approval }
   *       401: { description: Not authorized }
   *       404: { description: Distributor not found }
   */
  router.patch("/customers/distributors/:id/status", (req, res, next) =>
    updateDistributorStatus(io, req, res, next)
  );

  /**
   * @swagger
   * /customers:
   *   get:
   *     summary: List all customers (paginated, admin only)
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated customer list }
   *       401: { description: Not authorized }
   */
  router.get("/customers", getAllCustomers);

  /**
   * @swagger
   * /customers/{id}:
   *   get:
   *     summary: Get a single customer by ID
   *     tags: [Customers]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Customer found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 customer: { $ref: '#/components/schemas/Customer' }
   *   delete:
   *     summary: Delete a customer (admin only)
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Customer deleted successfully }
   *       401: { description: Not authorized }
   *       404: { description: Customer not found }
   */
  router.get("/customers/:id", getSingleCustomer);
  router.delete("/customers/:id", deleteCustomer);

  /**
   * @swagger
   * /auth/google:
   *   get:
   *     summary: Start Google OAuth sign-in
   *     tags: [Auth]
   *     parameters:
   *       - in: query
   *         name: platform
   *         schema: { type: string, enum: [web, mobile] }
   *     responses:
   *       302: { description: Redirects to Google }
   */
  router.get("/auth/google", googleAuth);

  /**
   * @swagger
   * /auth/google/callback:
   *   get:
   *     summary: Google OAuth callback
   *     tags: [Auth]
   *     responses:
   *       302: { description: Redirects back to the frontend/app with a token or error }
   */
  router.get("/auth/google/callback", googleCallback);

  return router;
};
module.exports = CustomerRouter;
