require("dotenv").config({
  path: process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env"
});

const express = require("express");
const { createServer } = require("http");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const passport = require("./config/passport");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// =============================================
// ✅ MIDDLEWARE — must come BEFORE routes
// =============================================

app.use(cors());
app.use(helmet());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));                      
app.use(express.urlencoded({ limit: "10mb", extended: true }));  
app.use(passport.initialize());

// =============================================
// 📄 SWAGGER DOCS
// =============================================
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Farm2Home API Docs",
  })
);

// =============================================
// SOCKET.IO
// =============================================
const { Server } = require("socket.io");
const Chat = require("./models/Chat");
const Order = require("./models/Order");
const { getAllNotifications } = require("./controllers/notification.controller");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {


  // Market rep joins their personal room
  socket.on("join_marketrep_room", (distributorId) => {
    if (!distributorId) {
      console.error("No distributorId provided in join_marketrep_room event.");
      return;
    }
    socket.join(`marketrep_${distributorId}`);
    console.log(`Distributor ${distributorId} joined room marketrep_${distributorId}`);
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

app.use("/", CustomerRouter(io));
app.use("/product", productRouter);
app.use("/cart", CartRouter);
app.use("/category", CategorieRouter);
app.use("/checkout", CheckOutRouter);
app.use("/order", OrderRouter(io));
app.use("/pricelist", PriceListRouter);
app.use("/contact", ContactRouter(io));
app.use("/news", NewsLetterRouter(io));
app.use("/notification", NotificationRouter(io));
app.use("/marketplace", MarketplaceRouter(io));
app.use("/review", ReviewRouter);
app.use("/driver", DriverRouter(io));
app.use("/marketrep", RepDashboardRouter(io));
app.use("/adverts", AdvertRouter());

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