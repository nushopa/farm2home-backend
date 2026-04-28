const { Router } = require("express");
const {
  addPriceList,
  getPriceList,
  deleteCity,
  editCity,
  getCityById,
} = require("../controllers/pricelist.controller");

const priceListRouter = Router();

// Add
priceListRouter.post("/add", addPriceList);

// Get all prices
priceListRouter.get("/", getPriceList);

// Delete city
priceListRouter.delete("/delete/:id", deleteCity);

// Edit city
priceListRouter.put("/edit", editCity);

// Get city by ID
priceListRouter.get("/:id", getCityById);

module.exports = priceListRouter;
