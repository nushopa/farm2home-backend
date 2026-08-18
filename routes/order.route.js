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

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Order lifecycle, assignment, and fulfillment
 */

const OrderRouter = (io) => {
  const router = Router();

  /**
   * @swagger
   * /order:
   *   post:
   *     summary: Place a new order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, products, address, customer_id, amount_paid]
   *             properties:
   *               orderID: { type: string }
   *               products:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     product_id: { type: object, properties: { _id: { type: string } } }
   *                     product_quatity: { type: integer }
   *               address:
   *                 type: object
   *                 properties:
   *                   address: { type: string }
   *                   city: { type: string }
   *                   email: { type: string }
   *                   first_name: { type: string }
   *               customer_id: { type: string }
   *               amount_paid: { type: number }
   *     responses:
   *       200:
   *         description: Order created and nearby distributors notified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 order: { $ref: '#/components/schemas/Order' }
   *                 distributors:
   *                   type: array
   *                   items: { type: object }
   *       400: { description: A product in the order is out of stock }
   *       404: { description: A product in the order was not found }
   *       422: { description: Missing required fields }
   *   get:
   *     summary: List all orders (paginated, staff only)
   *     tags: [Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200: { description: Paginated order list }
   *       401: { description: Not authorized }
   */
  router.post("/", (req, res, next) => addOrder(io, req, res, next));
  router.get("/", getAllOrders);

  /**
   * @swagger
   * /order/update:
   *   put:
   *     summary: Update an order's status
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, status]
   *             properties:
   *               orderID: { type: string }
   *               status:
   *                 type: string
   *                 description: e.g. "Processing", "Out for delivery", "Delivered"
   *     responses:
   *       200:
   *         description: Order updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 order: { $ref: '#/components/schemas/Order' }
   *       404: { description: Order not found }
   */
  router.put("/update", updateOrderStatus);

  /**
   * @swagger
   * /order/sign:
   *   put:
   *     summary: Sign/confirm delivery of an order using the delivery code
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, delivery_code]
   *             properties:
   *               orderID: { type: string }
   *               delivery_code: { type: string }
   *               product_image: { type: string }
   *     responses:
   *       200: { description: Order signed successfully }
   *       401: { description: Invalid delivery code }
   *       404: { description: Order not found }
   */
  router.put("/sign", (req, res, next) => signOrder(io, req, res, next));

  /**
   * @swagger
   * /order/assign:
   *   post:
   *     summary: Assign a distributor to an order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, distributorID]
   *             properties:
   *               orderID: { type: string }
   *               distributorID: { type: string }
   *     responses:
   *       200: { description: Distributor assigned }
   *       400: { description: Invalid distributor (must have role 6000) }
   *       404: { description: Order not found }
   * /order/unassign:
   *   post:
   *     summary: Unassign the distributor from an order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID]
   *             properties:
   *               orderID: { type: string }
   *     responses:
   *       200: { description: Distributor unassigned }
   *       400: { description: No distributor assigned }
   *       404: { description: Order not found }
   */
  router.post("/assign", assignDistributor);
  router.post("/unassign", unassignDistributor);

  /**
   * @swagger
   * /order/assign-driver:
   *   put:
   *     summary: Assign a driver to an order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, driverID]
   *             properties:
   *               orderID: { type: string }
   *               driverID: { type: string }
   *     responses:
   *       200: { description: Driver assigned }
   *       400: { description: A driver is already assigned }
   *       404: { description: Order or driver not found }
   * /order/unassign-driver:
   *   put:
   *     summary: Unassign the driver from an order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID]
   *             properties:
   *               orderID: { type: string }
   *     responses:
   *       200: { description: Driver unassigned }
   *       400: { description: No driver is assigned }
   *       404: { description: Order not found }
   */
  router.put("/assign-driver", assignDriver);
  router.put("/unassign-driver", unassignDriver);

  /**
   * @swagger
   * /order/update-pickup-location:
   *   put:
   *     summary: Set the pickup location and mark order "ready for pickup"
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, pickup_location]
   *             properties:
   *               orderID: { type: string }
   *               pickup_location: { type: object }
   *     responses:
   *       200: { description: Pickup location updated }
   *       404: { description: Order not found }
   *       422: { description: Missing fields }
   */
  router.put("/update-pickup-location", (req, res, next) =>
    updatePickupLocation(io, req, res, next)
  );

  /**
   * @swagger
   * /order/update-pickup-details:
   *   put:
   *     summary: Update pickup duration/distance, sets status to "pickup ongoing"
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID]
   *             properties:
   *               orderID: { type: string }
   *               pickup_duration: { type: string }
   *               pickup_distance: { type: string }
   *     responses:
   *       200: { description: Pickup details updated }
   *       404: { description: Order not found }
   */
  router.put("/update-pickup-details", (req, res, next) =>
    updatePickupDetails(io, req, res, next)
  );

  /**
   * @swagger
   * /order/update-delivery-details:
   *   put:
   *     summary: Update delivery duration/distance, sets status to "Shipped"
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID]
   *             properties:
   *               orderID: { type: string }
   *               delivery_duration: { type: string }
   *               delivery_distance: { type: string }
   *     responses:
   *       200: { description: Delivery details updated }
   *       404: { description: Order not found }
   */
  router.put("/update-delivery-details", (req, res, next) =>
    updateDeliveryDetails(io, req, res, next)
  );

  /**
   * @swagger
   * /order/total/order:
   *   get:
   *     summary: Total revenue across all orders
   *     tags: [Orders]
   *     responses:
   *       200:
   *         description: Total revenue
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties: { totalRevenue: { type: number } }
   * /order/total/sold:
   *   get:
   *     summary: Total number of products sold across all orders
   *     tags: [Orders]
   *     responses:
   *       200:
   *         description: Total units sold
   *         content:
   *           application/json:
   *             schema: { type: integer }
   * /order/total/revenue-per-month:
   *   get:
   *     summary: Revenue grouped by month
   *     tags: [Orders]
   *     responses:
   *       200: { description: Revenue by month }
   */
  router.get("/total/order", getTotalRevenue);
  router.get("/total/sold", getTotalProductsSold);
  router.get("/total/revenue-per-month", getTotalRevenueByMonth);

  /**
   * @swagger
   * /order/customer/{customer_id}:
   *   get:
   *     summary: Get all orders placed by a customer
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: customer_id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Orders for the customer
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Order' }
   */
  router.get("/customer/:customer_id", getOrdersByCustomer);

  /**
   * @swagger
   * /order/assigned/{orderID}:
   *   get:
   *     summary: Get the distributor assigned to an order
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: orderID
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Assigned distributor (or null) }
   *       404: { description: Order not found }
   * /order/distributor/{distributorID}:
   *   get:
   *     summary: Get all orders assigned to a distributor
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: distributorID
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Orders for this distributor }
   *       204: { description: No orders found }
   */
  router.get("/assigned/:orderID", getAssignedDistributor);
  router.get("/distributor/:distributorID", getOrdersByDistributor);

  /**
   * @swagger
   * /order/driver/assigned/{orderID}:
   *   get:
   *     summary: Get the driver assigned to an order
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: orderID
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Assigned driver (or null) }
   *       404: { description: Order not found }
   * /order/driver/{driverID}:
   *   get:
   *     summary: Get all orders assigned to a driver
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: driverID
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Orders for this driver }
   *       204: { description: No orders found }
   */
  router.get("/driver/assigned/:orderID", getAssignedDriver);
  router.get("/driver/:driverID", getOrdersByDriver);

  /**
   * @swagger
   * /order/confirm-delivery:
   *   post:
   *     summary: Confirm delivery using orderID + delivery code
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderID, delivery_code]
   *             properties:
   *               orderID: { type: string }
   *               delivery_code: { type: string }
   *     responses:
   *       200: { description: Delivery code confirmed, order marked Confirmed }
   *       400: { description: Missing orderID/delivery_code }
   *       404: { description: Order not found or invalid delivery code }
   */
  router.post("/confirm-delivery", confirmDeliveryCode);

  /**
   * @swagger
   * /order/{orderID}:
   *   get:
   *     summary: Get full order details, plus nearby distributors
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: orderID
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Order details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 orders:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Order' }
   *                 nearest: { type: array, items: { type: object } }
   *       404: { description: Order not found }
   */
  router.get("/:orderID", getOrdersByOrderId);

  return router;
};

module.exports = OrderRouter;
