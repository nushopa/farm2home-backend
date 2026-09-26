// --- Polyfill global crypto for Node 18 (mongodb driver expects it globally) ---
const { webcrypto } = require("crypto");
if (!globalThis.crypto) globalThis.crypto = webcrypto;

console.log("🔍 NODE VERSION:", process.version);
console.log("🔍 NODE_ENV at boot:", process.env.NODE_ENV);

require("dotenv").config({
  path: process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env"
});

const express = require("express");
const { createServer } = require("http");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const passport = require("./config/passport");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const corsMiddleware = require("./config/cors");

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

// =============================================
// ✅ MIDDLEWARE — must come BEFORE routes
// =============================================

app.use(corsMiddleware);
app.use(helmet());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(passport.initialize());

// =============================================
// 📄 SWAGGER DOCS
// =============================================
app.use(
  "/api-docs",
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Nushopa API Docs",
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// =============================================
// SOCKET.IO
// =============================================
const { Server } = require("socket.io");
const Chat = require("./models/Chat");
const Order = require("./models/Order");
// NOTE: getAllNotifications is no longer needed here — it used to be
// imported but was never actually called in this file.

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // Market rep joins their personal room (existing behavior, unchanged) —
  // order.controller.js / notification.controller.js emit order-assigned
  // notifications into marketrep_<distributorId>.
  socket.on("join_marketrep_room", (distributorId) => {
    if (!distributorId) {
      console.error("No distributorId provided in join_marketrep_room event.");
      return;
    }
    socket.join(`marketrep_${distributorId}`);
    console.log(`Distributor ${distributorId} joined room marketrep_${distributorId}`);
  });

  // New: customer joins their personal room — order.controller.js emits
  // order-placed / order-status notifications into customer_<customerId>.
  // Without this join, those emits go to an empty room and nobody gets them.
  socket.on("join_customer_room", (customerId) => {
    if (!customerId) {
      console.error("No customerId provided in join_customer_room event.");
      return;
    }
    socket.join(`customer_${customerId}`);
    console.log(`Customer ${customerId} joined room customer_${customerId}`);
  });

  // New: staff/admin dashboard joins the shared admin room —
  // order.controller.js emits the "new order placed" staff notification
  // into this room instead of broadcasting to every connected socket.
  socket.on("join_admin_room", () => {
    socket.join("admin");
    console.log(`Socket ${socket.id} joined room admin`);
  });

  // Same pattern for drivers, if/when a driver-facing notification is added
  // (orderDriver.controller.js would emit into driver_<driverId>).
  socket.on("join_driver_room", (driverId) => {
    if (!driverId) {
      console.error("No driverId provided in join_driver_room event.");
      return;
    }
    socket.join(`driver_${driverId}`);
    console.log(`Driver ${driverId} joined room driver_${driverId}`);
  });

  socket.on("joinRoom", async ({ orderID }) => {
    if (!orderID) {
      console.error("No orderID provided in joinRoom event.");
      return;
    }

    socket.join(orderID);

    try {
      const order = await Order.findOne({ orderID })
        .populate("customer_id")
        .populate("driver_assigned")
        .populate("distributor_assigned");

      const chat = await Chat.findOne({ orderID });

      if (chat && order) {
        const initialMessage = {
          orders: order,
          sender: "admin",
          type: "text",
          timestamp: order.updatedAt,
        };
        const data = [initialMessage, ...chat.messages];
        socket.emit("receiveMessage", data);
      } else {
        console.error(`Chat or order with ID ${orderID} not found.`);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  });

  socket.on("sendMessage", async (data) => {
    const { orderID, sender, type, text } = data;

    try {
      const order = await Order.findOne({ orderID })
        .populate("customer_id")
        .populate("driver_assigned")
        .populate("distributor_assigned");

      if (!order) {
        console.error(`Order with ID ${orderID} not found.`);
        return;
      }

      const message = { sender, type, text, timestamp: new Date() };

      const chat = await Chat.findOneAndUpdate(
        { orderID },
        { $push: { messages: message } },
        { new: true, upsert: true }
      );

      const savedMessage = chat.messages[chat.messages.length - 1];
      io.to(orderID).emit("receiveMessage", savedMessage);
    } catch (error) {
      console.error("Error in sendMessage:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// =============================================
// 🧭 ROUTES
// =============================================
const CustomerRouter = require("./routes/customer.route");
const ReviewRouter = require("./routes/review.route");
const productRouter = require("./routes/product.router");
const CartRouter = require("./routes/cart.route");
const CategorieRouter = require("./routes/categorie.route");
const PriceListRouter = require("./routes/pricelist.route");
const CheckOutRouter = require("./routes/checkout.route");
const OrderRouter = require("./routes/order.route");
const ContactRouter = require("./routes/contact.route");
const NewsLetterRouter = require("./routes/newsletter.route");
const NotificationRouter = require("./routes/notification.route");
const MarketplaceRouter = require("./routes/marketplace.route");
const DriverRouter = require("./routes/driver.route");
const RepDashboardRouter = require("./routes/repDashboard.router");
const AdvertRouter = require("./routes/advertRoutes");
const ConsentRoute = require("./routes/consentRoutes");
const deviceRouter = require("./routes/device.route");
const PaymentRouter = require("./routes/payment.route");
const WebhookRouter = require("./routes/webhook.route");

app.use("/", CustomerRouter(io));
// productRouter.js is now a factory (see routes/product.router.js) so
// addProduct can receive io and persist/broadcast new-product notifications.
app.use("/product", productRouter(io));
app.use("/cart", CartRouter);
app.use("/category", CategorieRouter);
app.use("/checkout", CheckOutRouter);
app.use("/order", OrderRouter(io));
app.use("/pricelist", PriceListRouter);
app.use("/contact", ContactRouter(io));
app.use("/news", NewsLetterRouter(io));
// FIX: notification.route.js's GET handlers no longer emit over sockets,
// so it doesn't need io anymore.
app.use("/notification", NotificationRouter());
app.use("/marketplace", MarketplaceRouter(io));
app.use("/review", ReviewRouter);
app.use("/driver", DriverRouter(io));
app.use("/marketrep", RepDashboardRouter(io));
app.use("/adverts", AdvertRouter());
app.use("/consent", ConsentRoute());
// FIX: device.route.js now takes io, so sendMarketingPush can persist +
// broadcast the marketing notification, not just push it.
app.use("/device", deviceRouter(io));
app.use("/payment", PaymentRouter());
app.use("/webhook", WebhookRouter());

// 404 fallback
app.use((req, res) => {
  res.status(404).send("Page not found!");
});

if (process.env.NODE_ENV === "production") {
  console.log("🔒 Running in PRODUCTION mode");
  if (!process.env.PORT) {
    console.warn("⚠️  No PORT defined in .env.production — using default 3000");
  }
} else {
  console.log("🔧 Running in LOCAL/DEVELOPMENT mode");
}

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`📄 Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error);
    process.exit(1);
  });