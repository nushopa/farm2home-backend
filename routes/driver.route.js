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

const DriverRouter = (io) => {
  const router = Router();

  //create driver account
  router.post("/request-otp", requestOTP);
  router.post("/verify-otp", verifyOTP);
  router.post("/select-vehicle", selectVehicleType);
  router.post("/create", (req, res, next) =>
    createDriverAccount(io, req, res, next)
  );

  router.post("/oauth-reg", initialRegistration);
  router.post("/create-oauth", (req, res, next) =>
    createOauthDriverAccount(io, req, res, next)
  );

  //login driver
  router.post("/login", signInDriver);

  //forgot password
  router.post("/forgot", forgotPassword);
  router.post("/reset-password", resetPassword);

  //get requests drivers
  router.get("/:id", getSingleDriver);
  router.get("/", getAllDrivers);

  //update driver
  router.put("/:id", editDriver);
  router.put("/:id/review", updateDriverReviewStatus);

  //delete driver
  router.delete("/:id", deleteDriver);

  return router;
};

module.exports = DriverRouter;
