const { Router } = require("express");
const {
  addCategorie,
  removeCategorie,
  getCategories,
} = require("../controllers/categorie.controller");

const CategorieRouter = Router();

// add categorie
CategorieRouter.post("/add", addCategorie);

// get all categories
CategorieRouter.get("/get", getCategories);

// delete categorie
CategorieRouter.delete("/delete", removeCategorie);

module.exports = CategorieRouter;
