const Categorie = require("../models/Categorie");
const categoryData = require("../data/category");
const Product = require("../models/Product");

module.exports.getCategories = async (req, res, next) => {
  try {
    res.status(200).send(categoryData);
  } catch (error) {
    next(error);
  }
};

module.exports.addCategorie = async (req, res, next) => {
  try {
    if (req.body.cat) {
      await Categorie.create({
        name: req.body.cat,
      })
        .then((data) => res.status(201).send({ data }))
        .catch((error) => res.status(400).send({ error }));
    } else {
      return;
    }
  } catch (error) {
    next(error);
  }
};

module.exports.removeCategorie = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (req.body.id) {
      await Categorie.findByIdAndDelete(id)
        .then((data) => res.status(200).send({ data }))
        .catch((error) => res.status(400).send({ error }));
    } else {
      return;
    }
  } catch (error) {
    next(error);
  }
};

module.exports.getByQuery = async (req, res, next) => {
  try {
    const { cat, subcat, subsubcat } = req.query;
    // Find the main category
    const category = categoryData.agriculturalCategories.find(
      (item) => item.category.toLowerCase() === cat.toLowerCase()
    );
    if (!category) {
      return res.status(404).send({ error: "Category not found" });
    }
    // Check for subcategories
    if (subcat) {
      const subcategory = category.subcategories.find(
        (item) => item.name.toLowerCase() === subcat.toLowerCase()
      );

      if (!subcategory) {
        return res.status(404).send({ error: "Subcategory not found" });
      }

      // Check for subsubcategories
      if (subsubcat) {
        const subsubcategory = subcategory.subsubcategories.find(
          (item) => item.toLowerCase() === subsubcat.toLowerCase()
        );

        if (!subsubcategory) {
          return res.status(404).send({ error: "Subsubcategory not found" });
        }

        // Retrieve products from the database based on the selected subsubcategory
        const products = await Product.find({
          product_cat: cat,
          product_sub_cat: subcat,
          product_sub_sub_cat: subsubcategory,
        });

        return res.status(200).send(products);
      }

      // Retrieve products from the database based on the selected subcategory
      const products = await Product.find({
        product_cat: cat,
        product_sub_cat: subcat,
      });

      return res.status(200).send(products);
    }

    // Retrieve products from the database based on the selected category
    const products = await Product.find({ product_cat: cat });
    return res.status(200).send(products);
  } catch (error) {
    next(error);
  }
};
