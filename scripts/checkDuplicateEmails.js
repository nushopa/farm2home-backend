// scripts/checkDuplicateEmails.js
const mongoose = require("mongoose");
const Customer = require("../models/Customer");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const duplicates = await Customer.aggregate([
    {
      $group: {
        _id: { $toLower: "$email" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length === 0) {
    console.log("No duplicate emails found. Safe to add unique index.");
  } else {
    console.log("Duplicate emails found — resolve these before adding unique index:");
    console.log(JSON.stringify(duplicates, null, 2));
  }

  await mongoose.disconnect();
})();