const { Router } = require("express");
const {
  getAllProduct,
  addProduct,
  getSingleProduct,
  removeProduct,
  updateProduct,
  getProductCount,
  toggleStock,
} = require("../controllers/product.controller");
const { getByQuery } = require("../controllers/categorie.controller");

const productRouter = Router();

// Get all products
productRouter.get("/", getAllProduct);

// Get Single product
productRouter.get("/get/:id", getSingleProduct);

// Add product
productRouter.post("/add", addProduct);

// remove product
productRouter.delete("/remove/:id", removeProduct);

// update product
productRouter.put("/update", updateProduct);

// toggle a product's out-of-stock status (admin)
productRouter.patch("/toggle-stock", toggleStock);

productRouter.get("/categories", getByQuery);

productRouter.get("/total", getProductCount);

module.exports = productRouter;