const Cart = require("../models/Cart");
const Product = require("../models/Product");

module.exports.addToCart = async (req, res, next) => {
  try {
    // get the user and the product ID
    const { product_id, customer_id } = req.body;
    if (!product_id || !customer_id)
      return res
        .status(400)
        .send({ message: "Customer or product ID is required" });

    // Block out-of-stock products from being added at all
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    if (product.out_of_stock) {
      return res
        .status(400)
        .send({ message: "This product is currently out of stock" });
    }

    // Check if the product already exists in the cart for the customer
    const existingCartItem = await Cart.findOne({ product_id, customer_id });
    if (existingCartItem) {
      return res
        .status(400)
        .send({ message: "Product already exists in the cart" });
    } else {
      // Save to cart
      const cartItem = await Cart.create({
        product_id,
        customer_id,
      });

      // Populate product details
      const result = await cartItem.populate("product_id");
      return res.status(200).send({ product: result });
    }
  } catch (error) {
    next(error);
  }
};

module.exports.getSingleCart = async (req, res, next) => {
  try {
    const cart = await Cart.find({ customer_id: req.params.id }).populate(
      "product_id"
    );
    return res.status(200).send({ cart });
  } catch (error) {
    next(error);
  }
};

// increment
module.exports.addToQuatity = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id).populate("product_id");

    if (cart) {
      // Guard against incrementing quantity on a product that went
      // out of stock while it was already sitting in the cart.
      if (cart.product_id?.out_of_stock) {
        return res
          .status(400)
          .send({ message: "This product is currently out of stock" });
      }
      cart.product_quatity += 1;
      await cart.save();
      return res.status(200).send({ cart: cart._id });
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};

// decrement
module.exports.minusToQuatity = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id);

    if (cart) {
      if (cart.product_quatity !== 1) {
        cart.product_quatity -= 1;
        await cart.save();
        return res.status(200).send(cart._id);
      } else {
        await Cart.findByIdAndDelete(cart._id)
          .then((data) => {
            return res.status(200).send({ cart: data._id });
          })
          .catch((error) => {
            return res
              .status(400)
              .send({ message: "An error occured please try again later" });
          });
      }
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};

// delete cart
module.exports.deleteFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findById(req.body.id);

    if (cart) {
      await Cart.findByIdAndDelete(cart._id)
        .then((data) => {
          return res.status(200).send({ cart: data._id });
        })
        .catch((error) => {
          return res
            .status(400)
            .send({ message: "An error occured please try again later" });
        });
    } else {
      return res.status(404).send({ message: "Cart not found" });
    }
  } catch (error) {
    next(error);
  }
};