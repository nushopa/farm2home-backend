const { Router } = require("express");
const {
  getAllProduct,
  addProduct,
  getSingleProduct,
  removeProduct,
  updateProduct,
  getProductCount,
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

productRouter.get("/categories", getByQuery);

productRouter.get("/total", getProductCount);

module.exports = productRouter;
