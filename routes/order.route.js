const { Router } = require("express");
const {
  addOrder,
  updateOrderStatus,
  getAllOrders,
  getOrdersByOrderId,
  getOrdersByCustomer,
  signOrder,
} = require("../controllers/order.controller");
const {
  getTotalRevenue,
  getTotalProductsSold,
  getTotalRevenueByMonth,
} = require("../controllers/dashboardSummary.controller");
const {
  updatePickupLocation,
  updatePickupDetails,
  updateDeliveryDetails,
} = require("../controllers/location.controller");
const {
  assignDistributor,
  unassignDistributor,
  getAssignedDistributor,
  getOrdersByDistributor,
  confirmDeliveryCode,
} = require("../controllers/orderMarketRep.controller");
const {
  assignDriver,
  unassignDriver,
  getAssignedDriver,
  getOrdersByDriver,
} = require("../controllers/orderDriver.controller");

const OrderRouter = (io) => {
  const router = Router();

  // ── Static routes first ──────────────────────────────────────────

  // Base routes
  router.post("/", (req, res, next) => addOrder(io, req, res, next));
  router.get("/", getAllOrders);
  router.put("/update", updateOrderStatus);
  router.put("/sign", (req, res, next) => signOrder(io, req, res, next));

  // Distributor assignment
  router.post("/assign", assignDistributor);
  router.post("/unassign", unassignDistributor);

  // Driver assignment
  router.put("/assign-driver", assignDriver);
  router.put("/unassign-driver", unassignDriver);

  // Location updates
  router.put("/update-pickup-location", (req, res, next) =>
    updatePickupLocation(io, req, res, next)
  );
  router.put("/update-pickup-details", (req, res, next) =>
    updatePickupDetails(io, req, res, next)
  );
  router.put("/update-delivery-details", (req, res, next) =>
    updateDeliveryDetails(io, req, res, next)
  );

  // Dashboard summary
  router.get("/total/order", getTotalRevenue);
  router.get("/total/sold", getTotalProductsSold);
  router.get("/total/revenue-per-month", getTotalRevenueByMonth);

  // Customer orders
  router.get("/customer/:customer_id", getOrdersByCustomer);

  // Distributor / driver GET routes
  router.get("/assigned/:orderID", getAssignedDistributor);
  router.get("/distributor/:distributorID", getOrdersByDistributor);
  router.get("/driver/assigned/:orderID", getAssignedDriver);
  router.get("/driver/:driverID", getOrdersByDriver);
  router.post("/confirm-delivery", confirmDeliveryCode);

  router.get("/:orderID", getOrdersByOrderId);

  return router;
};

module.exports = OrderRouter;