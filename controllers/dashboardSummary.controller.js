const Order = require("../models/Order");
const Customer = require("../models/Customer");

async function getTotalProductsSold(req, res, next) {
  try {
    const orders = await Order.find();
    let totalProductsSold = 0;
    orders.forEach((order) => {
      order.products.forEach((product) => {
        totalProductsSold += product.product_quatity;
      });
    });
    res.status(200).json(totalProductsSold);
  } catch (error) {
    console.error("Error calculating total products sold:", error);
    throw error;
  }
}

async function getTotalRevenue(req, res, next) {
  try {
    const orders = await Order.find();
    let totalRevenue = 0;
    orders.forEach((order) => {
      totalRevenue += order.amount_paid;
    });
    res.status(200).json({ totalRevenue });
  } catch (error) {
    res.status(500).json({ error: "Error calculating total revenue" });
  }
}

async function getTotalRevenueByMonth(req, res, next) {
  try {
    const orders = await Order.find();
    const revenueByMonth = {};

    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const month = date.toLocaleString("default", { month: "short" }); // Months are 0-indexed, so add 1
      const revenue = order.amount_paid;

      if (!revenueByMonth[month]) {
        revenueByMonth[month] = revenue;
      } else {
        revenueByMonth[month] += revenue;
      }
    });

    res.status(200).json({ revenueByMonth });
  } catch (error) {
    res.status(500).json({ error: "Error calculating total revenue by month" });
  }
}

async function getCustomerCount(req, res, next) {
  try {
    // Count the total number of customers
    const totalCustomer = await Customer.countDocuments();
    return res.status(200).send({ totalCustomer });
  } catch (error) {
    console.error("Error while fetching total customer count:", error);
    return res
      .status(500)
      .send({ error: "Error fetching total customer count" });
  }
};

async function uploadAdvert(req, res) {
  try {
    const { title, imageUrl } = req.body;
    const advert = new Advert({ title, imageUrl });
    await advert.save();
    res.status(201).json(advert);
  } catch (error) {
    console.error("Error uploading advert:", error);
    res.status(500).json({ error: "Error uploading advert" });
  }
}

module.exports = {
  getTotalRevenue,
  getTotalProductsSold,
  getTotalRevenueByMonth,
  getCustomerCount,
  uploadAdvert,
};
