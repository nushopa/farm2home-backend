const Product = require("../models/Product");
const Cart = require("../models/Cart");
const { sendPushNotification } = require("../lib/util/sendPush");

module.exports.getAllProduct = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    if (q) {
      const products = await Product.find({ product_cat: q })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Product.countDocuments({ product_cat: q });

      return res.status(200).send({
        products,
        totalItems,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / limit),
      });
    }

    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalItems = await Product.countDocuments();

    return res.status(200).send({
      products,
      totalItems,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getSingleProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    return res.status(200).send({ product });
  } catch (error) {
    next(error);
  }
};

module.exports.addProduct = async (req, res, next) => {
  try {
    const {
      alt_image,
      product_total,
      product_name,
      product_brand_name,
      product_des,
      product_price,
      product_cat,
      product_sub_cat,
      product_sub_sub_cat,
      product_rate,
      product_image,
      product_cost_price,
      out_of_stock,
    } = req.body;

    if (
      !product_name ||
      !product_des ||
      !product_price ||
      !product_cat ||
      !product_rate ||
      !product_total ||
      !product_cost_price
    )
      return res.status(400).send({ message: "Field are required!" });

    // upload image to cloudinary
    //const result = await cloudinary.uploader.upload(req.body.product_image)
    const newProduct = await Product.create({
      product_name,
      product_brand_name,
      product_image,
      alt_image,
      product_des,
      product_price,
      product_cat,
      product_sub_cat,
      product_sub_sub_cat,
      product_rate,
      product_total,
      product_cost_price,
      // Defaults to false in the schema if not provided, but respected if the
      // admin form explicitly sets a product as out of stock at creation time.
      out_of_stock: out_of_stock ?? false,
    });

    // --- Push notification (marketing) ---
    // Goes to every device with marketingPushEnabled on. Non-blocking:
    // a push failure should never fail the product-creation request.
    try {
      await sendPushNotification({
        title: "New product on Nushopa 🛍️",
        body: `${newProduct.product_name} just landed — check it out!`,
        data: { type: "new-product", productId: newProduct._id.toString() },
        kind: "marketing",
      });
    } catch (pushErr) {
      console.error("Failed to send new-product push:", pushErr);
    }

    return res.status(201).send({ data: newProduct });
  } catch (error) {
    next(error);
  }
};

module.exports.removeProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    // find product in the cart and delete it
    await Cart.find({ product_id: id }).deleteMany();
    // find the product by ID and delete
    await Product.findByIdAndDelete(id)
      .then((data) => res.status(200).send({ message: "deleted a product" }))
      .catch((error) =>
        res
          .status(400)
          .send({ message: "An error occured please try again later" })
      );
  } catch (error) {
    next(error);
  }
};

module.exports.updateProduct = async (req, res, next) => {
  try {
    const { id, ...updateData } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.status(200).send({ data: updatedProduct });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error });
  }
};


module.exports.toggleStock = async (req, res, next) => {
  try {
    const { id, out_of_stock } = req.body;

    if (!id || typeof out_of_stock !== "boolean") {
      return res
        .status(400)
        .send({ message: "id and a boolean out_of_stock are required." });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: { out_of_stock } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).send({ message: "Product not found." });
    }

    res.status(200).send({ data: updatedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "An unknown error occurred." });
  }
};

module.exports.getProductCount = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments();
    return res.status(200).send({ totalProducts });
  } catch (error) {
    next(error);
  }
};