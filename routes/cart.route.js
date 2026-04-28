const { Router } = require("express");
const {
  addToCart,
  getSingleCart,
  deleteFromCart,
  addToQuatity,
  minusToQuatity,
} = require("../controllers/cart.controller");

const CartRouter = Router();

// Add to cart
CartRouter.post("/add", addToCart);

// get my cart
CartRouter.get("/get/:id", getSingleCart);

// cart inc
CartRouter.put("/inc", addToQuatity);

// cart dec
CartRouter.put("/dec", minusToQuatity);

// delete
CartRouter.delete("/delete", deleteFromCart);

module.exports = CartRouter;
