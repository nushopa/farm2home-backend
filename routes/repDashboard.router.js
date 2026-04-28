const {Router} = require("express");

const { 
    getTotalAssignedOrders, 
    getConfirmedOrders, 
    getPendingOrders, 
    getTotalCommission, 
    getAssignedOrders
} = require("../controllers/marketRepDashboard.controller");

const { authMiddleware } = require("../middleware/authMiddleware");

const RepDashboardRouter = () => {
    const router = Router();
    router.get("/distributor-assigned/:distributorId", authMiddleware, getAssignedOrders);
    router.get("/assigned-orders/:distributorId", authMiddleware, getTotalAssignedOrders);
    router.get("/confirmed-orders/:distributorId", authMiddleware, getConfirmedOrders);
    router.get("/pending-orders/:distributorId", authMiddleware, getPendingOrders);
    router.get("/total-commission/:distributorId", authMiddleware, getTotalCommission);

    return router;
};

module.exports = RepDashboardRouter;