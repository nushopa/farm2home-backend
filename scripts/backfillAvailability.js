require("dotenv").config({ path: ".env.production" }); // local database. See Step 5 for production.
const mongoose = require("mongoose");
const Customer = require("../models/Customer");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB);
    console.log("Connected to:", mongoose.connection.name);

    const before = await Customer.countDocuments({ availability: { $exists: false } });
    console.log("Customers missing availability:", before);

    const result = await Customer.updateMany(
      { availability: { $exists: false } },
      { $set: { availability: true } }
    );
    console.log("Matched:", result.matchedCount, "Modified:", result.modifiedCount);

    const after = await Customer.countDocuments({ availability: { $exists: false } });
    console.log("Still missing after backfill:", after); // should be 0
  } catch (err) {
    console.error("Backfill failed:", err);
  } finally {
    await mongoose.disconnect();
  }
})();