const { Router } = require("express");

const {
  addressBook,
  addAdress,
  deleteAddress,
} = require("../controllers/checkout.controller");

const checkOutRouter = Router();

// post request to add address
checkOutRouter.post("/price", addAdress);
// get request to get all address based on a particular customer
checkOutRouter.get("/address/:id", addressBook);
// delete address based on a particular customer
checkOutRouter.delete("/address/:id", deleteAddress);

module.exports = checkOutRouter;
