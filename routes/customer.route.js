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

const CustomerRouter = (io) => {
  const router = Router();

  // Auth routes
  router.post("/create", (req, res, next) => createAccount(io, req, res, next));
  router.post("/verify-otp", (req, res, next) =>
    verifyOTPAndCreateAccount(io, req, res, next),
  );
  router.post("/resend-otp", resendOTP);
  router.post("/login", loginUser);
  router.post("/logout", logoutUser);

  // Forget password routes (specific static paths first)
  router.post("/customers/forget", forgetPassword);
  router.post("/customers/verify", verifyCode);
  router.post("/customers/update", updateUserPassword);

  // Profile routes
  router.get("/profile", getProfileDetails);
  router.put("/update/profile", updateProfile);
  router.put("/update/market-rep/profile", updateMarketRepProfile);

  // Stats
  router.get("/customer/customer-per-month", getCustomerCountByMonth);
  router.get("/customers/total", getCustomerCount);

  // ✅ Distributor routes BEFORE /customers/:id
  router.get("/customers/distributors", getAllDistributors);
  router.get("/customers/distributors/:id", getSingleDistributor); // ← must come before /:id
router.patch("/customers/distributors/:id/status", (req, res, next) =>
    updateDistributorStatus(io, req, res, next)
  );
  // ✅ Wildcard routes LAST
  router.get("/customers", getAllCustomers);
  router.get("/customers/:id", getSingleCustomer); // ← wildcard, goes last
  router.delete("/customers/:id", deleteCustomer);


  //google auth
  router.get("/auth/google", googleAuth);
  router.get("/auth/google/callback", googleCallback);

  return router;
};
module.exports = CustomerRouter;
