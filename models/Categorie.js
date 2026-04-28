const { Schema, model } = require("mongoose");

const CategorieSchema = new Schema(
  {
    name: String,
  },
  { timestamps: true }
);

module.exports = model("Categorie", CategorieSchema);
