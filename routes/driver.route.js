const { Router } = require("express");
const {
  createDriverAccount,
  requestOTP,
  verifyOTP,
  selectVehicleType,
  initialRegistration,
  createOauthDriverAccount,
} = require("../controllers/driver/createDriver.controller");
const { signInDriver } = require("../controllers/driver/login.controller");
const {
  forgotPassword,
  resetPassword,
} = require("../controllers/driver/forgotPassword.controller");
const {
  getSingleDriver,
  getAllDrivers,
} = require("../controllers/driver/getDriver.controller");
const {
  editDriver,
  updateDriverReviewStatus,
} = require("../controllers/driver/editDriver.controller");
const {
  deleteDriver,
} = require("../controllers/driver/deleteDriver.controller");

/**
 * @swagger
 * tags:
 *   - name: Drivers
 *     description: Driver registration, auth, and account management
 */

const DriverRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /driver/request-otp:
   *   post:
   *     summary: "Driver registration — request OTP"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string }
   *     responses:
   *       200: { description: OTP sent }
   *       400: { description: Email already registered }
   */
  router.post("/request-otp", requestOTP);

  /**
   * @swagger
   * /driver/verify-otp:
   *   post:
   *     summary: "Driver registration — verify OTP"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, otp]
   *             properties:
   *               email: { type: string }
   *               otp: { type: string }
   *     responses:
   *       200: { description: OTP verified }
   *       400: { description: Invalid/expired OTP }
   */
  router.post("/verify-otp", verifyOTP);

  /**
   * @swagger
   * /driver/select-vehicle:
   *   post:
   *     summary: "Driver registration — select vehicle type"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, vehicleType]
   *             properties:
   *               email: { type: string }
   *               vehicleType: { type: string }
   *     responses:
   *       200: { description: Vehicle type recorded }
   *       400: { description: OTP not verified yet }
   */
  router.post("/select-vehicle", selectVehicleType);

  /**
   * @swagger
   * /driver/create:
   *   post:
   *     summary: "Driver registration — final account creation"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - firstName
   *               - lastName
   *               - password
   *               - phoneNumber
   *               - dateOfBirth
   *               - address
   *               - workCity
   *               - proofOfIdentity
   *               - licenseFile
   *             properties:
   *               email: { type: string }
   *               firstName: { type: string }
   *               lastName: { type: string }
   *               password: { type: string }
   *               phoneNumber: { type: string }
   *               dateOfBirth: { type: string }
   *               address: { type: string }
   *               workCity: { type: string }
   *               proofOfIdentity: { type: string }
   *               licenseFile: { type: string }
   *               profilePicture: { type: string }
   *     responses:
   *       201:
   *         description: Driver account created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token: { type: string }
   *                 data: { $ref: '#/components/schemas/Driver' }
   *       400: { description: Missing fields, OTP not verified, or phone already registered }
   */
  router.post("/create", (req, res, next) =>
    createDriverAccount(io, req, res, next)
  );

  /**
   * @swagger
   * /driver/oauth-reg:
   *   post:
   *     summary: "OAuth driver registration — Step 1"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string }
   *               firstName: { type: string }
   *               lastName: { type: string }
   *               password: { type: string }
   *               profilePicture: { type: string }
   *     responses:
   *       200: { description: Initial data stored }
   *       400: { description: Already registered or pending }
   */
  router.post("/oauth-reg", initialRegistration);

  /**
   * @swagger
   * /driver/create-oauth:
   *   post:
   *     summary: "OAuth driver registration — finalize account"
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, phoneNumber, dateOfBirth, address, workCity, proofOfIdentity, licenseFile]
   *             properties:
   *               email: { type: string }
   *               phoneNumber: { type: string }
   *               dateOfBirth: { type: string }
   *               address: { type: string }
   *               workCity: { type: string }
   *               proofOfIdentity: { type: string }
   *               licenseFile: { type: string }
   *     responses:
   *       201: { description: Driver account created }
   *       400: { description: Missing fields, vehicle type missing, or phone already registered }
   */
  router.post("/create-oauth", (req, res, next) =>
    createOauthDriverAccount(io, req, res, next)
  );

  /**
   * @swagger
   * /driver/login:
   *   post:
   *     summary: Driver login (email or phone number)
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [password]
   *             properties:
   *               email: { type: string }
   *               phoneNumber: { type: string }
   *               password: { type: string }
   *     responses:
   *       200: { description: Logged in }
   *       401: { description: Invalid credentials }
   *       404: { description: Driver not found }
   */
  router.post("/login", signInDriver);

  /**
   * @swagger
   * /driver/forgot:
   *   post:
   *     summary: Request a driver password-reset email
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email: { type: string }
   *     responses:
   *       200: { description: Reset link sent }
   *       404: { description: Driver not found }
   */
  router.post("/forgot", forgotPassword);

  /**
   * @swagger
   * /driver/reset-password:
   *   post:
   *     summary: Reset a driver's password using a reset token
   *     tags: [Drivers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token, newPassword]
   *             properties:
   *               token: { type: string }
   *               newPassword: { type: string }
   *     responses:
   *       200: { description: Password reset successful }
   *       401: { description: Reset token expired }
   *       404: { description: Invalid or expired token }
   */
  router.post("/reset-password", resetPassword);

  /**
   * @swagger
   * /driver/{id}:
   *   get:
   *     summary: Get a driver by ID
   *     tags: [Drivers]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Driver found
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Driver' }
   *       404: { description: Driver not found }
   *   put:
   *     summary: Edit a driver's information
   *     tags: [Drivers]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Driver information updated }
   *       400: { description: Status cannot be updated unless review is true }
   *       404: { description: Driver not found }
   *   delete:
   *     summary: Delete a driver
   *     tags: [Drivers]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Driver deleted successfully }
   *       404: { description: Driver not found }
   */
  router.get("/:id", getSingleDriver);
  router.put("/:id", editDriver);
  router.delete("/:id", deleteDriver);

  /**
   * @swagger
   * /driver/:
   *   get:
   *     summary: List all drivers (paginated, staff only)
   *     tags: [Drivers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated driver list }
   *       401: { description: Not authorized }
   */
  router.get("/", getAllDrivers);

  /**
   * @swagger
   * /driver/{id}/review:
   *   put:
   *     summary: Update a driver's review status
   *     tags: [Drivers]
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
   *             required: [review]
   *             properties:
   *               review: { type: boolean }
   *     responses:
   *       200: { description: Review status updated }
   *       404: { description: Driver not found }
   */
  router.put("/:id/review", updateDriverReviewStatus);

  return router;
};

module.exports = DriverRouter;