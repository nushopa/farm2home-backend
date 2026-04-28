const { Schema, model } = require("mongoose");

const ProductSchema = new Schema(
  {
    product_name: {
      type: String,
      required: true,
      trim: true,
    },
    product_brand_name: {
      type: String,
      required: false,
      trim: true,
    },
    product_price: {
      type: Number,
      required: true,
    },
    product_cost_price: {
      type: Number,
      required: true,
    },
    product_des: {
      type: String,
      trim: true,
      required: true,
    },
    product_image: {
      type: String,
      required: true,
    },
    product_cat: {
      type: String,
      required: true,
    },
    product_sub_cat: {
      type: String,
      required: false,
    },
    product_sub_sub_cat: {
      type: String,
      required: false,
    },
    alt_image: {
      type: Array,
    },
    product_rate: {
      type: Number,
      required: true,
    },
    product_total: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = model("Product", ProductSchema);
