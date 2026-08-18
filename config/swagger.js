const swaggerJsdoc = require("swagger-jsdoc");

const LOCAL_URL = `http://localhost:${process.env.PORT || 3000}`;

const PROD_URL =
  process.env.RENDER_EXTERNAL_URL ||
  "https://farm2home-backend-lkg9.onrender.com";

// Treat it as "production" if NODE_ENV says so, OR if Render's own
// injected env var is present — this stops the dropdown from silently
// defaulting to localhost when NODE_ENV isn't set correctly on the host.
const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER_EXTERNAL_URL;

const servers = isProd
  ? [
      { url: PROD_URL, description: "Production (Render)" },
      { url: LOCAL_URL, description: "Local development" },
    ]
  : [
      { url: LOCAL_URL, description: "Local development" },
      { url: PROD_URL, description: "Production (Render)" },
    ];

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Farm2Home API",
      version: "1.0.0",
      description:
        "Farm2Home backend API documentation. Switch servers using the dropdown " +
        "in the top-right of this page to try requests against localhost or the " +
        "live Render deployment.",
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: { type: "string", example: "Something went wrong" },
          },
        },
        Customer: {
          type: "object",
          properties: {
            _id: { type: "string" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string", format: "email" },
            phone_number: { type: "string" },
            role: {
              type: "integer",
              description: "2001 = customer, 6000 = market rep / distributor",
            },
            status: { type: "string", enum: ["pending", "approved", "rejected"] },
            profile_completed: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            product_name: { type: "string" },
            product_brand_name: { type: "string" },
            product_des: { type: "string" },
            product_price: { type: "number" },
            product_cost_price: { type: "number" },
            product_cat: { type: "string" },
            product_sub_cat: { type: "string" },
            product_sub_sub_cat: { type: "string" },
            product_rate: { type: "number" },
            product_total: { type: "number" },
            product_image: { type: "string" },
            alt_image: { type: "string" },
            out_of_stock: { type: "boolean" },
          },
        },
        Order: {
          type: "object",
          properties: {
            _id: { type: "string" },
            orderID: { type: "string" },
            address: { type: "object" },
            customer_id: { type: "string" },
            products: { type: "array", items: { type: "object" } },
            amount_paid: { type: "number" },
            status: { type: "string" },
            delivery_code: { type: "string" },
            distributor_assigned: { type: "string", nullable: true },
            driver_assigned: { type: "string", nullable: true },
          },
        },
        CartItem: {
          type: "object",
          properties: {
            _id: { type: "string" },
            product_id: { type: "string" },
            customer_id: { type: "string" },
            product_quatity: { type: "integer" },
          },
        },
        Market: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            city: { type: "string" },
            distributors: { type: "array", items: { type: "string" } },
          },
        },
        PriceListEntry: {
          type: "object",
          properties: {
            _id: { type: "string" },
            city: { type: "string" },
            estimatePrice: { type: "number" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            _id: { type: "string" },
            category: { type: "string" },
            title: { type: "string" },
            message: { type: "string" },
            orderId: { type: "string" },
            customer_id: { type: "string" },
            isRead: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Driver: {
          type: "object",
          properties: {
            _id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phoneNumber: { type: "string" },
            vehicleType: { type: "string" },
            status: { type: "boolean" },
            review: { type: "boolean" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/**/*.js"],
};

module.exports = swaggerJsdoc(options);